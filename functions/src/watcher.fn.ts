import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import fetch from 'node-fetch';
import { computeDiff } from './diff-engine';

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

export const watcherScheduled = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'Europe/Rome',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async () => {
    logger.info('Watcher started');
    const configs = await db.collection('watchConfigs').get();
    for (const doc of configs.docs) {
      try {
        await processConfig(doc.id, doc.data());
      } catch (err) {
        logger.error(`Error processing config ${doc.id}`, err);
      }
    }
    logger.info('Watcher completed');
  }
);

async function processConfig(
  configId: string,
  config: FirebaseFirestore.DocumentData
): Promise<void> {
  const spec = await fetchSpec(config['specUrl'], config['extraHeaders'] ?? {});
  const specStr = JSON.stringify(spec);
  const hash = createHash('sha256').update(specStr).digest('hex').slice(0, 12);

  const existing = await db
    .collection('specVersions')
    .where('configId', '==', configId)
    .where('hash', '==', hash)
    .limit(1)
    .get();

  if (!existing.empty) {
    logger.info(`Config ${configId}: no change (${hash})`);
    return;
  }

  const specRef = `specs/${configId}/${hash}.json`;
  await bucket.file(specRef).save(specStr, { contentType: 'application/json' });

  const info = (spec as Record<string, Record<string, string>>)['info'] ?? {};
  const newVersionRef = db.collection('specVersions').doc();
  await newVersionRef.set({
    configId,
    hash,
    version: info['version'] ?? 'unknown',
    title: info['title'] ?? 'Unknown API',
    endpointCount: countEndpoints(spec as Record<string, unknown>),
    specRef,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(`Config ${configId}: saved version ${hash}`);

  const previous = await db
    .collection('specVersions')
    .where('configId', '==', configId)
    .orderBy('timestamp', 'desc')
    .limit(2)
    .get();

  if (previous.docs.length >= 2) {
    const prevDoc = previous.docs[1];
    await generateDiff(
      configId,
      prevDoc.id,
      newVersionRef.id,
      prevDoc.data()['specRef'],
      spec as Record<string, unknown>
    );
  }

  await pruneOldVersions(configId, config['maxHistory'] ?? 50);
}

async function fetchSpec(
  url: string,
  extraHeaders: Record<string, string>
): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...extraHeaders },
    timeout: 30_000,
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

function countEndpoints(spec: Record<string, unknown>): number {
  const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  const paths = (spec['paths'] ?? {}) as Record<string, Record<string, unknown>>;
  return Object.values(paths).reduce(
    (count, item) => count + Object.keys(item).filter((m) => HTTP_METHODS.includes(m)).length,
    0
  );
}

async function generateDiff(
  configId: string,
  oldVersionId: string,
  newVersionId: string,
  oldSpecRef: string,
  newSpec: Record<string, unknown>
): Promise<void> {
  const [oldBuf] = await bucket.file(oldSpecRef).download();
  const oldSpec = JSON.parse(oldBuf.toString());

  const diffData = computeDiff(oldSpec, newSpec, configId, oldVersionId, newVersionId);

  const reportRef = db.collection('diffReports').doc();
  const changesRef = `diffs/${configId}/${reportRef.id}.json`;
  await bucket
    .file(changesRef)
    .save(JSON.stringify(diffData.changes), { contentType: 'application/json' });

  await reportRef.set({
    configId,
    oldVersionId,
    newVersionId,
    summary: diffData.summary,
    changesRef,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(`Diff saved: ${oldVersionId} → ${newVersionId}`);
}

async function pruneOldVersions(configId: string, maxHistory: number): Promise<void> {
  const all = await db
    .collection('specVersions')
    .where('configId', '==', configId)
    .orderBy('timestamp', 'desc')
    .get();

  if (all.docs.length <= maxHistory) return;

  const toDelete = all.docs.slice(maxHistory);
  for (let i = 0; i < toDelete.length; i += 500) {
    const batch = db.batch();
    toDelete.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  logger.info(`Config ${configId}: pruned ${toDelete.length} old versions`);
}
