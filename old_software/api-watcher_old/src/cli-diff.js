#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────
//  cli-diff.js  —  confronta manualmente due versioni dalla history
//  Uso:
//    node src/cli-diff.js                  (confronta ultima e penultima)
//    node src/cli-diff.js <file1> <file2>  (confronta due file specifici)
//    node src/cli-diff.js --list           (elenca la history)
// ─────────────────────────────────────────────

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join, basename } from 'path';
import { execSync } from 'child_process';
import { HISTORY_DIR as _HISTORY_DIR, REPORTS_DIR as _REPORTS_DIR, SPEC_URL } from '../config';
import { compareSpecs } from './diff-engine';
import { generateReport } from './report-generator';

const HISTORY_DIR = resolve(__dirname, '..', _HISTORY_DIR);
const REPORTS_DIR = resolve(__dirname, '..', _REPORTS_DIR);
mkdirSync(REPORTS_DIR, { recursive: true });

const args = process.argv.slice(2);

if (args.includes('--list') || args.includes('-l')) {
  const files = readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort();
  if (!files.length) { console.log('Nessuna versione in history.'); process.exit(0); }
  console.log(`\nVersioni salvate in ${HISTORY_DIR}:\n`);
  files.forEach((f, i) => {
    const spec = JSON.parse(readFileSync(join(HISTORY_DIR, f), 'utf8'));
    const v = spec?.info?.version || '—';
    const t = spec?.info?.title || '—';
    console.log(`  [${i}] ${f}  →  ${t} v${v}`);
  });
  console.log();
  process.exit(0);
}

let file1, file2;
const files = readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort();

if (args.length >= 2) {
  file1 = resolve(args[0]);
  file2 = resolve(args[1]);
} else if (files.length >= 2) {
  file1 = join(HISTORY_DIR, files[files.length - 2]);
  file2 = join(HISTORY_DIR, files[files.length - 1]);
  console.log(`Confronto: ${basename(file1)} → ${basename(file2)}`);
} else {
  console.error('Servono almeno 2 versioni in history. Avvia prima il watcher.');
  process.exit(1);
}

const oldSpec = JSON.parse(readFileSync(file1, 'utf8'));
const newSpec = JSON.parse(readFileSync(file2, 'utf8'));

const diffResult = compareSpecs(oldSpec, newSpec);
const s = diffResult.stats;

console.log(`\n── Sommario diff ─────────────────────────────`);
console.log(`  ➕ Endpoint aggiunti:  ${s.endpointsAdded}  (${s.fieldsAdded} campi)`);
console.log(`  ➖ Endpoint rimossi:   ${s.endpointsRemoved}  (${s.fieldsRemoved} campi)`);
console.log(`  ✏️  Endpoint modificati: ${s.endpointsChanged}  (${s.fieldsChanged} campi)`);
console.log(`  ⚠️  Breaking changes:   ${s.breakingChanges}`);
console.log(`─────────────────────────────────────────────\n`);

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const html = generateReport({
  ...diffResult,
  oldVersion: oldSpec?.info?.version || 'old',
  newVersion: newSpec?.info?.version || 'new',
  generatedAt: new Date().toLocaleString('it-IT'),
  specUrl: SPEC_URL,
});

const reportPath = join(REPORTS_DIR, `diff-manual-${timestamp}.html`);
writeFileSync(reportPath, html);
console.log(`Report HTML: ${reportPath}`);

try { execSync(`open "${reportPath}"`); } catch {}
