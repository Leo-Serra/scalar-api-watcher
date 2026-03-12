'use strict';

// ─────────────────────────────────────────────
//  watcher.js  —  entry point del processo
// ─────────────────────────────────────────────

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { execSync } = require('child_process');
const fetch   = require('node-fetch');
const yaml    = require('js-yaml');
const cron    = require('node-cron');
const config  = require('../config');
const { compareSpecs }     = require('./diff-engine');
const { generateReport }   = require('./report-generator');

// ── Paths ─────────────────────────────────────
const HISTORY_DIR = path.resolve(__dirname, '..', config.HISTORY_DIR);
const REPORTS_DIR = path.resolve(__dirname, '..', config.REPORTS_DIR);
[HISTORY_DIR, REPORTS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── Logging ───────────────────────────────────
function log(emoji, msg) {
  console.log(`${new Date().toISOString()}  ${emoji}  ${msg}`);
}

// ── Spec fetching ─────────────────────────────

// Scalar di solito rende disponibile la spec su uno di questi path
const CANDIDATE_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/api-docs',
  '/api-docs.json',
  '/v1/openapi.json',
  '/docs/openapi.json',
  '/swagger.json',
  '/swagger.yaml',
];

async function fetchSpec(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { 'Accept': 'application/json, text/yaml, */*', ...config.EXTRA_HEADERS };

  // Se l'URL termina già con un'estensione nota, prova direttamente
  if (/\.(json|yaml|yml)$/.test(base)) {
    return tryFetch(base, headers);
  }

  // Prova tutti i path candidati
  for (const candidate of CANDIDATE_PATHS) {
    const url = base + candidate;
    try {
      const spec = await tryFetch(url, headers);
      if (spec) {
        log('🔗', `Spec trovata su: ${url}`);
        return { spec, resolvedUrl: url };
      }
    } catch {}
  }
  throw new Error(`Impossibile trovare la spec OpenAPI su ${base}. Controlla SPEC_URL in config.js`);
}

async function tryFetch(url, headers) {
  const res = await fetch(url, { headers, timeout: 15000 });
  if (!res.ok) return null;
  const text = await res.text();
  // parse JSON or YAML
  try { return { spec: JSON.parse(text), resolvedUrl: url }; } catch {}
  try { return { spec: yaml.load(text), resolvedUrl: url }; } catch {}
  return null;
}

// ── History management ────────────────────────

function listHistory() {
  return fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json'))
    .sort(); // ISO timestamps → cronologico
}

function hashSpec(spec) {
  return crypto.createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 12);
}

function saveSpec(spec, timestamp) {
  const filename = `${timestamp}.json`;
  fs.writeFileSync(path.join(HISTORY_DIR, filename), JSON.stringify(spec, null, 2));
  return filename;
}

function loadSpec(filename) {
  return JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, filename), 'utf8'));
}

function specVersion(spec) {
  return spec?.info?.version || spec?.info?.title || 'unknown';
}

function pruneHistory() {
  if (!config.MAX_HISTORY) return;
  const files = listHistory();
  if (files.length > config.MAX_HISTORY) {
    const toDelete = files.slice(0, files.length - config.MAX_HISTORY);
    toDelete.forEach(f => {
      fs.unlinkSync(path.join(HISTORY_DIR, f));
      log('🗑 ', `Rimossa versione vecchia: ${f}`);
    });
  }
}

// ── Report ────────────────────────────────────

function saveReport(diffResult, oldSpec, newSpec, timestamp, resolvedUrl) {
  const filename = `diff-${timestamp}.html`;
  const html = generateReport({
    ...diffResult,
    oldVersion: specVersion(oldSpec),
    newVersion: specVersion(newSpec),
    generatedAt: new Date(timestamp).toLocaleString('it-IT'),
    specUrl: resolvedUrl,
  });
  const reportPath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(reportPath, html);
  return reportPath;
}

function openInBrowser(filePath) {
  try {
    execSync(`open "${filePath}"`); // macOS
  } catch {}
}

// ── Core check ────────────────────────────────

async function check() {
  log('🔄', 'Avvio controllo spec...');

  let fetchResult;
  try {
    fetchResult = await fetchSpec(config.SPEC_URL);
  } catch (err) {
    log('❌', `Errore fetch: ${err.message}`);
    return;
  }

  const { spec: currentSpec, resolvedUrl } = fetchResult;
  const currentHash = hashSpec(currentSpec);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const history = listHistory();

  if (history.length === 0) {
    // Prima esecuzione — salva e basta
    saveSpec(currentSpec, timestamp);
    log('💾', `Prima versione salvata (hash: ${currentHash})`);
    return;
  }

  // Carica l'ultima versione salvata
  const lastFile = history[history.length - 1];
  const lastSpec = loadSpec(lastFile);
  const lastHash = hashSpec(lastSpec);

  if (currentHash === lastHash) {
    log('✅', `Nessuna modifica (hash: ${currentHash})`);
    return;
  }

  // Spec cambiata!
  log('🆕', `Modifiche rilevate! ${lastHash} → ${currentHash}`);

  // Salva la nuova versione
  saveSpec(currentSpec, timestamp);

  // Genera il diff
  const diffResult = compareSpecs(lastSpec, currentSpec);

  // Stampa sommario in console
  const s = diffResult.stats;
  log('📊', `Sommario: +${s.endpointsAdded} endpoint, -${s.endpointsRemoved} endpoint, ~${s.endpointsChanged} modificati, ⚠ ${s.breakingChanges} breaking`);

  // Genera report HTML
  const reportPath = saveReport(diffResult, lastSpec, currentSpec, timestamp, resolvedUrl);
  log('📄', `Report salvato: ${reportPath}`);

  if (config.OPEN_REPORT_ON_CHANGE) {
    openInBrowser(reportPath);
  }

  pruneHistory();
}

// ── Entry point ───────────────────────────────

log('🚀', `API Watcher avviato`);
log('🔗', `URL: ${config.SPEC_URL}`);
log('⏰', `Schedule: ${config.CRON_SCHEDULE}`);
log('📁', `History: ${HISTORY_DIR}`);
log('📁', `Reports: ${REPORTS_DIR}`);
log('─'.repeat(60));

// Esegui subito al primo avvio
check();

// Poi ogni X (da config)
cron.schedule(config.CRON_SCHEDULE, () => check());
