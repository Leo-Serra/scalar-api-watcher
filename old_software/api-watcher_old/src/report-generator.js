'use strict';

// ─────────────────────────────────────────────
//  report-generator.js  —  genera HTML della diff
// ─────────────────────────────────────────────

function badge(text, cls) {
  return `<span class="badge badge-${cls}">${text}</span>`;
}

function fieldRow(row) {
  if (row.type === 'removed') {
    return `<tr class="diff-row">
      <td class="diff-cell old"><span class="prefix prefix-old">−</span><span class="field-name">${row.key}</span>: <span class="field-type">${row.old.type}</span>${row.old.required ? '<span class="field-req">required</span>' : ''}<span class="breaking-tag">⚠ breaking</span></td>
      <td class="diff-cell empty"></td>
    </tr>`;
  }
  if (row.type === 'added') {
    return `<tr class="diff-row">
      <td class="diff-cell empty"></td>
      <td class="diff-cell new"><span class="prefix prefix-new">+</span><span class="field-name">${row.key}</span>: <span class="field-type">${row.new.type}</span>${row.new.required ? '<span class="field-req">required</span>' : ''}</td>
    </tr>`;
  }
  // changed
  return `<tr class="diff-row">
    <td class="diff-cell old"><span class="prefix prefix-old">−</span><span class="field-name">${row.key}</span>: <span class="field-type">${row.old.type}</span>${row.old.required ? '<span class="field-req">required</span>' : ''}${row.breaking ? '<span class="breaking-tag">⚠ breaking</span>' : ''}</td>
    <td class="diff-cell new"><span class="prefix prefix-new">+</span><span class="field-name">${row.key}</span>: <span class="field-type">${row.new.type}</span>${row.new.required ? '<span class="field-req">required</span>' : ''}</td>
  </tr>`;
}

function sectionHtml(section) {
  if (!section.rows.length) return '';
  return `
    <div class="section-title">${section.title}</div>
    <table class="diff-table">
      <thead><tr><th>⟵ Precedente</th><th>Nuova ⟶</th></tr></thead>
      <tbody>${section.rows.map(fieldRow).join('')}</tbody>
    </table>`;
}

function endpointHtml(ep, idx) {
  let badges = '';
  if (ep.status === 'added')   badges += badge('NUOVO', 'added');
  if (ep.status === 'removed') badges += badge('ELIMINATO', 'removed');
  if (ep.breaking)             badges += badge('⚠ BREAKING', 'breaking');
  if (ep.hasAdded)             badges += badge('+campi', 'added-sm');
  if (ep.hasRemoved)           badges += badge('−campi', 'removed-sm');
  if (ep.hasChanged)           badges += badge('~tipo', 'changed-sm');

  let body = '';
  if (ep.status === 'added') {
    body = `<div class="ep-note added-note">✓ Nuovo endpoint aggiunto</div>`;
  } else if (ep.status === 'removed') {
    body = `<div class="ep-note removed-note">✗ Endpoint rimosso — possibile breaking change per i client</div>`;
  } else {
    body = (ep.sections || []).map(sectionHtml).join('');
  }

  return `
  <details class="ep-group" ${ep.breaking ? 'open' : ''}>
    <summary class="ep-header">
      <span class="method method-${ep.method}">${ep.method}</span>
      <span class="ep-path">${ep.path}</span>
      <span class="badges">${badges}</span>
    </summary>
    <div class="ep-body">${body}</div>
  </details>`;
}

function generateReport({ endpoints, stats, oldVersion, newVersion, generatedAt, specUrl }) {
  const noChanges = endpoints.length === 0;

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>API Diff — ${generatedAt}</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#0d0f12;--s:#13161b;--s2:#1a1e26;--bd:#252932;--bd2:#2e3440;--tx:#e2e8f0;--mu:#64748b;--ac:#38bdf8;--add:#22c55e;--add-bg:#052e16;--add-line:#14532d;--rem:#f87171;--rem-bg:#2d0a0a;--rem-line:#450a0a;--chg:#fbbf24;--chg-bg:#1c1408;--chg-line:#3d2800;--brk:#f43f5e;--brk-bg:#2d0a14;--mono:'JetBrains Mono',monospace;--sans:'Syne',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--tx);font-family:var(--sans);min-height:100vh}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(var(--bd) 1px,transparent 1px),linear-gradient(90deg,var(--bd) 1px,transparent 1px);background-size:40px 40px;opacity:.25;pointer-events:none}
header{position:relative;z-index:10;padding:24px 32px;border-bottom:1px solid var(--bd2);display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.logo{font-size:20px;font-weight:800;letter-spacing:-.5px}.logo span{color:var(--ac)}
.meta{font-family:var(--mono);font-size:11px;color:var(--mu);margin-left:auto}
.main{position:relative;z-index:5;max-width:1500px;margin:0 auto;padding:28px 32px}
.summary{display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap}
.chip{font-family:var(--mono);font-size:12px;padding:6px 14px;border-radius:20px;border:1px solid;display:flex;align-items:center;gap:6px}
.chip-add{color:var(--add);border-color:var(--add-line);background:var(--add-bg)}
.chip-rem{color:var(--rem);border-color:var(--rem-line);background:var(--rem-bg)}
.chip-chg{color:var(--chg);border-color:var(--chg-line);background:var(--chg-bg)}
.chip-brk{color:var(--brk);border-color:#881337;background:var(--brk-bg)}
.no-changes{text-align:center;padding:80px 32px;color:var(--mu)}
.no-changes .icon{font-size:48px;margin-bottom:16px;opacity:.4}
.no-changes h2{font-size:20px;color:var(--tx);margin-bottom:8px}
.ep-group{margin-bottom:12px;border:1px solid var(--bd2);border-radius:10px;overflow:hidden}
.ep-header{padding:13px 18px;background:var(--s2);display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none;transition:background .15s}
.ep-header:hover{background:#1e2330}
.ep-header::-webkit-details-marker{display:none}
.method{font-family:var(--mono);font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;min-width:52px;text-align:center}
.method-GET{background:#0c2a1a;color:#4ade80;border:1px solid #14532d}
.method-POST{background:#0c1d2a;color:#38bdf8;border:1px solid #0c4a6e}
.method-PUT{background:#2a1c0c;color:#fbbf24;border:1px solid #451a03}
.method-PATCH{background:#1e1a0c;color:#fcd34d;border:1px solid #3d2800}
.method-DELETE{background:#2a0c0c;color:#f87171;border:1px solid #450a0a}
.ep-path{font-family:var(--mono);font-size:13px;flex:1}
.badges{display:flex;gap:5px;flex-wrap:wrap}
.badge{font-family:var(--mono);font-size:10px;padding:2px 7px;border-radius:3px;font-weight:600}
.badge-added,.badge-added-sm{background:var(--add-line);color:var(--add)}
.badge-removed,.badge-removed-sm{background:var(--rem-line);color:var(--rem)}
.badge-changed-sm{background:var(--chg-line);color:var(--chg)}
.badge-breaking{background:#881337;color:#fda4af}
.ep-body{border-top:1px solid var(--bd2)}
.ep-note{padding:14px 18px;font-family:var(--mono);font-size:12px}
.added-note{color:var(--add)}.removed-note{color:var(--rem)}
.section-title{font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--mu);padding:10px 18px 8px;background:var(--s);border-bottom:1px solid var(--bd);font-family:var(--mono)}
.diff-table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12px}
.diff-table thead tr{background:var(--s)}
.diff-table th{padding:7px 16px;text-align:left;font-size:10px;color:var(--mu);letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid var(--bd);width:50%}
.diff-row{border-bottom:1px solid var(--bd)}
.diff-row:last-child{border-bottom:none}
.diff-cell{padding:8px 16px;vertical-align:top;line-height:1.5}
.diff-cell.old{background:var(--rem-bg);border-right:3px solid var(--rem)}
.diff-cell.new{background:var(--add-bg);border-right:3px solid var(--add)}
.diff-cell.empty{background:var(--bg);opacity:.4}
.prefix{display:inline-block;width:14px;font-weight:700;margin-right:4px}
.prefix-old{color:var(--rem)}.prefix-new{color:var(--add)}
.field-name{color:var(--ac)}.field-type{color:var(--chg)}
.field-req{color:#a78bfa;font-size:10px;margin-left:5px}
.breaking-tag{color:var(--brk);font-size:10px;margin-left:8px;background:var(--brk-bg);border:1px solid #881337;padding:1px 6px;border-radius:3px}
@media(max-width:800px){.main{padding:16px}.ep-path{font-size:11px}}
</style>
</head>
<body>
<header>
  <div class="logo">api<span>diff</span></div>
  <div style="font-family:var(--mono);font-size:11px;color:var(--mu)">
    ${specUrl} &nbsp;·&nbsp; 
    <span style="color:var(--rem)">v${oldVersion}</span>
    &nbsp;→&nbsp;
    <span style="color:var(--add)">v${newVersion}</span>
  </div>
  <div class="meta">${generatedAt}</div>
</header>
<div class="main">
${noChanges ? `
  <div class="no-changes">
    <div class="icon">✓</div>
    <h2>Nessuna differenza rilevata</h2>
    <p style="font-size:13px;color:var(--mu)">Le due versioni sono identiche.</p>
  </div>` : `
  <div class="summary">
    <span class="chip chip-add">➕ ${stats.endpointsAdded} endpoint aggiunti &nbsp;·&nbsp; ${stats.fieldsAdded} campi</span>
    <span class="chip chip-rem">➖ ${stats.endpointsRemoved} endpoint rimossi &nbsp;·&nbsp; ${stats.fieldsRemoved} campi</span>
    <span class="chip chip-chg">✏️ ${stats.endpointsChanged} endpoint modificati &nbsp;·&nbsp; ${stats.fieldsChanged} campi</span>
    <span class="chip chip-brk">⚠️ ${stats.breakingChanges} breaking changes</span>
  </div>
  ${endpoints.map((ep, i) => endpointHtml(ep, i)).join('\n')}
`}
</div>
</body>
</html>`;
}

module.exports = { generateReport };
