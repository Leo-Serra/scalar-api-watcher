"use strict";

// ─────────────────────────────────────────────
//  dashboard.js  —  web UI per history e report
//  Avvio: node src/dashboard.js
//  Apri:  http://localhost:3456
// ─────────────────────────────────────────────

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const yaml = require("js-yaml");
const config = require("../config");
const { compareSpecs } = require("./diff-engine");
const { generateReport } = require("./report-generator");

const HISTORY_DIR = path.resolve(__dirname, "..", config.HISTORY_DIR);
const REPORTS_DIR = path.resolve(__dirname, "..", config.REPORTS_DIR);
const PORT = 3456;

[HISTORY_DIR, REPORTS_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

// ── Helpers ───────────────────────────────────

function readHistory() {
  return fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(HISTORY_DIR, f), "utf8");
      const spec = JSON.parse(raw);
      const ts = f
        .replace(".json", "")
        .replace(/T/, " ")
        .replace(/-(?=\d\d-\d\d-\d\d\.\d+Z$)/, ":")
        .replace(/-(?=\d\d\.\d+Z$)/, ":")
        .replace(/\.\d+Z$/, "");
      return {
        file: f,
        timestamp: ts,
        version: spec?.info?.version || "—",
        title: spec?.info?.title || "—",
        endpointCount: Object.keys(spec?.paths || {}).length,
        hash: crypto.createHash("sha256").update(raw).digest("hex").slice(0, 8),
      };
    });
}

function readReports() {
  return fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".html"))
    .sort()
    .reverse()
    .map((f) => ({
      file: f,
      timestamp: f
        .replace("diff-", "")
        .replace(".html", "")
        .replace(/T/, " ")
        .replace(/-(?=\d\d-\d\d-\d\d\.\d+Z$)/, ":")
        .replace(/-(?=\d\d\.\d+Z$)/, ":")
        .replace(/\.\d+Z$/, ""),
    }));
}

// ── Dashboard HTML ────────────────────────────

function dashboardHtml(history, reports) {
  const historyRows = history
    .map((h, i) => {
      const isLatest = i === history.length - 1;
      return `
    <div class="version-card ${isLatest ? "latest" : ""}" style="animation-delay:${i * 40}ms">
      <div class="version-left">
        <div class="version-dot ${isLatest ? "dot-latest" : ""}"></div>
        ${i < history.length - 1 ? '<div class="version-line"></div>' : ""}
      </div>
      <div class="version-body">
        <div class="version-header">
          <span class="version-tag">v${h.version}</span>
          ${isLatest ? '<span class="badge-latest">LATEST</span>' : ""}
          <span class="version-hash">#${h.hash}</span>
          <span class="version-ts">${h.timestamp}</span>
        </div>
        <div class="version-meta">${h.title} &nbsp;·&nbsp; ${h.endpointCount} endpoint</div>
        <div class="version-actions">
          <button class="btn-sm" onclick="viewSpec('${h.file}')">📄 Vedi spec</button>
          ${i > 0 ? `<button class="btn-sm btn-diff" onclick="diffWith('${history[i - 1].file}','${h.file}')">⚡ Diff con precedente</button>` : ""}
          ${
            i > 0
              ? `<select class="sel-compare" onchange="if(this.value) diffWith(this.value,'${h.file}')"><option value="">Confronta con...</option>${history
                  .slice(0, i)
                  .map(
                    (x) =>
                      `<option value="${x.file}">${x.timestamp} v${x.version}</option>`,
                  )
                  .join("")}</select>`
              : ""
          }
        </div>
      </div>
    </div>`;
    })
    .reverse()
    .join("");

  const reportRows = reports.length
    ? reports
        .map(
          (r, i) => `
    <a class="report-row" href="/reports/${r.file}" target="_blank" style="animation-delay:${i * 30}ms">
      <span class="report-icon">📊</span>
      <span class="report-name">${r.file.replace("diff-", "").replace(".html", "")}</span>
      <span class="report-arrow">→</span>
    </a>`,
        )
        .join("")
    : `<div class="empty-reports">Nessun report ancora — aspetta il primo cambio</div>`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>API Watcher — Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0b0d10;--s:#111318;--s2:#181c24;--bd:#1e2330;--bd2:#252d3d;
  --tx:#dde4f0;--mu:#4a5568;--mu2:#64748b;
  --ac:#38bdf8;--ac2:#0ea5e9;
  --add:#34d399;--add-bg:#022c22;
  --rem:#f87171;--rem-bg:#2d0a0a;
  --chg:#fbbf24;--brk:#f43f5e;
  --mono:'JetBrains Mono',monospace;--sans:'Syne',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--tx);font-family:var(--sans);min-height:100vh}

/* subtle dot grid */
body::before{content:'';position:fixed;inset:0;
  background-image:radial-gradient(circle,#1e2330 1px,transparent 1px);
  background-size:28px 28px;opacity:.6;pointer-events:none;z-index:0}

/* glow top */
body::after{content:'';position:fixed;top:-120px;left:50%;transform:translateX(-50%);
  width:600px;height:300px;
  background:radial-gradient(ellipse,rgba(56,189,248,.08) 0%,transparent 70%);
  pointer-events:none;z-index:0}

/* ── Layout ── */
.layout{position:relative;z-index:1;display:grid;grid-template-columns:280px 1fr;min-height:100vh}

/* ── Sidebar ── */
.sidebar{border-right:1px solid var(--bd);background:var(--s);padding:0;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
.sidebar-brand{padding:24px 20px 20px;border-bottom:1px solid var(--bd)}
.logo{font-size:20px;font-weight:800;letter-spacing:-.5px}.logo span{color:var(--ac)}
.logo-sub{font-family:var(--mono);font-size:10px;color:var(--mu2);letter-spacing:2px;margin-top:2px}
.sidebar-section{padding:20px 0}
.sidebar-label{font-family:var(--mono);font-size:9px;color:var(--mu);letter-spacing:2px;text-transform:uppercase;padding:0 20px 10px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 20px;cursor:pointer;font-size:13px;font-weight:600;color:var(--mu2);transition:all .15s;border-left:2px solid transparent}
.nav-item:hover,.nav-item.active{color:var(--tx);background:var(--s2);border-left-color:var(--ac)}
.sidebar-stats{margin-top:auto;padding:16px 20px;border-top:1px solid var(--bd);display:grid;grid-template-columns:1fr 1fr;gap:8px}
.stat-box{background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:10px 12px}
.stat-num{font-family:var(--mono);font-size:20px;font-weight:700;color:var(--ac)}
.stat-label{font-size:10px;color:var(--mu2);margin-top:2px}

/* ── Main ── */
.main{overflow-y:auto}
.page-header{padding:32px 36px 24px;border-bottom:1px solid var(--bd)}
.page-title{font-size:22px;font-weight:800;letter-spacing:-.3px}
.page-sub{font-size:12px;color:var(--mu2);font-family:var(--mono);margin-top:4px}
.content{padding:28px 36px}

/* ── Section ── */
.section{margin-bottom:40px}
.section-head{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.section-title{font-size:14px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--mu2)}
.section-count{font-family:var(--mono);font-size:11px;padding:2px 8px;background:var(--s2);border:1px solid var(--bd2);border-radius:10px;color:var(--mu2)}
.refresh-btn{margin-left:auto;font-family:var(--mono);font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid var(--bd2);background:transparent;color:var(--mu2);cursor:pointer;transition:all .15s}
.refresh-btn:hover{border-color:var(--ac);color:var(--ac)}

/* ── Version timeline ── */
.version-card{display:flex;gap:0;animation:fadeUp .3s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

.version-left{display:flex;flex-direction:column;align-items:center;padding-right:16px;padding-top:6px;min-width:24px}
.version-dot{width:10px;height:10px;border-radius:50%;background:var(--bd2);border:2px solid var(--mu);flex-shrink:0}
.dot-latest{background:var(--ac);border-color:var(--ac);box-shadow:0 0 8px rgba(56,189,248,.4)}
.version-line{flex:1;width:2px;background:var(--bd);margin-top:4px;margin-bottom:4px;min-height:20px}

.version-body{flex:1;background:var(--s);border:1px solid var(--bd);border-radius:10px;padding:14px 18px;margin-bottom:10px;transition:border-color .2s}
.version-body:hover{border-color:var(--bd2)}
.version-card.latest .version-body{border-color:rgba(56,189,248,.25);background:linear-gradient(135deg,var(--s) 0%,rgba(56,189,248,.04) 100%)}

.version-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
.version-tag{font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ac)}
.badge-latest{font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:3px;background:rgba(56,189,248,.15);color:var(--ac);border:1px solid rgba(56,189,248,.3);letter-spacing:1px}
.version-hash{font-family:var(--mono);font-size:10px;color:var(--mu);background:var(--s2);padding:1px 6px;border-radius:3px}
.version-ts{font-family:var(--mono);font-size:10px;color:var(--mu);margin-left:auto}
.version-meta{font-size:11px;color:var(--mu2);margin-bottom:10px}
.version-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}

.btn-sm{font-family:var(--mono);font-size:11px;padding:5px 11px;border-radius:5px;border:1px solid var(--bd2);background:transparent;color:var(--mu2);cursor:pointer;transition:all .15s;white-space:nowrap}
.btn-sm:hover{border-color:var(--ac);color:var(--ac);background:rgba(56,189,248,.06)}
.btn-diff{border-color:rgba(251,191,36,.3);color:var(--chg)}
.btn-diff:hover{border-color:var(--chg);background:rgba(251,191,36,.06)}

.sel-compare{font-family:var(--mono);font-size:11px;padding:5px 10px;border-radius:5px;border:1px solid var(--bd2);background:var(--s2);color:var(--mu2);cursor:pointer;outline:none}
.sel-compare:hover{border-color:var(--bd2)}

/* ── Reports ── */
.report-row{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--s);border:1px solid var(--bd);border-radius:8px;margin-bottom:8px;text-decoration:none;color:var(--tx);transition:all .15s;animation:fadeUp .3s ease both}
.report-row:hover{border-color:var(--ac);background:var(--s2)}
.report-icon{font-size:16px}
.report-name{font-family:var(--mono);font-size:12px;flex:1;color:var(--mu2)}
.report-row:hover .report-name{color:var(--tx)}
.report-arrow{color:var(--mu);font-size:14px;transition:transform .15s}
.report-row:hover .report-arrow{transform:translateX(4px);color:var(--ac)}
.empty-reports{padding:32px;text-align:center;color:var(--mu);font-size:13px;font-family:var(--mono)}

/* ── Spec modal ── */
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;backdrop-filter:blur(4px)}
.modal-overlay.open{display:flex;align-items:center;justify-content:center}
.modal{background:var(--s);border:1px solid var(--bd2);border-radius:12px;width:90vw;max-width:900px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}
.modal-header{padding:16px 20px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:10px}
.modal-title{font-size:14px;font-weight:700;flex:1}
.modal-close{background:none;border:none;color:var(--mu2);font-size:20px;cursor:pointer;padding:0 4px;line-height:1}
.modal-close:hover{color:var(--tx)}
.modal-body{overflow-y:auto;padding:20px;flex:1}
pre.spec-code{font-family:var(--mono);font-size:11.5px;line-height:1.6;color:#94a3b8;white-space:pre-wrap;word-break:break-all}

/* ── Diff panel ── */
.diff-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:100;backdrop-filter:blur(4px);overflow-y:auto}
.diff-overlay.open{display:block}
.diff-container{max-width:1400px;margin:40px auto;padding:0 24px 60px}
.diff-top-bar{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.diff-close{font-family:var(--mono);font-size:12px;padding:7px 14px;border-radius:6px;border:1px solid var(--bd2);background:var(--s);color:var(--mu2);cursor:pointer;transition:all .15s}
.diff-close:hover{border-color:var(--rem);color:var(--rem)}
.diff-title{font-size:14px;font-weight:700}

@media(max-width:768px){
  .layout{grid-template-columns:1fr}
  .sidebar{display:none}
  .content{padding:16px}
}
</style>
</head>
<body>
<div class="layout">

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="logo">api<span>watcher</span></div>
      <div class="logo-sub">SCALAR MONITOR</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-label">Navigazione</div>
      <div class="nav-item active" onclick="showSection('history')">📦 &nbsp;History versioni</div>
      <div class="nav-item" onclick="showSection('reports')">📊 &nbsp;Report diff</div>
    </div>
    <div class="sidebar-stats">
      <div class="stat-box">
        <div class="stat-num">${history.length}</div>
        <div class="stat-label">Versioni salvate</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">${reports.length}</div>
        <div class="stat-label">Report generati</div>
      </div>
    </div>
  </aside>

  <!-- Main -->
  <main class="main">
    <div class="page-header">
      <div class="page-title">Dashboard</div>
      <div class="page-sub">${config.SPEC_URL}</div>
    </div>
    <div class="content">

      <!-- History section -->
      <div class="section" id="section-history">
        <div class="section-head">
          <span class="section-title">History versioni</span>
          <span class="section-count">${history.length}</span>
          <button class="refresh-btn" onclick="location.reload()">↻ Aggiorna</button>
        </div>
        ${history.length ? `<div class="timeline">${historyRows}</div>` : '<div class="empty-reports">Nessuna versione ancora — avvia il watcher</div>'}
      </div>

      <!-- Reports section -->
      <div class="section" id="section-reports" style="display:none">
        <div class="section-head">
          <span class="section-title">Report diff</span>
          <span class="section-count">${reports.length}</span>
          <button class="refresh-btn" onclick="location.reload()">↻ Aggiorna</button>
        </div>
        <div>${reportRows}</div>
      </div>

    </div>
  </main>
</div>

<!-- Spec modal -->
<div class="modal-overlay" id="specModal" onclick="closeModal()">
  <div class="modal" onclick="event.stopPropagation()">
    <div class="modal-header">
      <span class="modal-title" id="modalTitle">Spec</span>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body"><pre class="spec-code" id="specContent"></pre></div>
  </div>
</div>

<!-- Inline diff panel -->
<div class="diff-overlay" id="diffOverlay">
  <div class="diff-container">
    <div class="diff-top-bar">
      <button class="diff-close" onclick="closeDiff()">✕ Chiudi</button>
      <span class="diff-title" id="diffTitle">Diff</span>
    </div>
    <div id="diffContent"></div>
  </div>
</div>

<script>
function showSection(name) {
  document.getElementById('section-history').style.display = name === 'history' ? '' : 'none';
  document.getElementById('section-reports').style.display = name === 'reports' ? '' : 'none';
  document.querySelectorAll('.nav-item').forEach((el, i) => {
    el.classList.toggle('active', (i === 0 && name === 'history') || (i === 1 && name === 'reports'));
  });
}

async function viewSpec(file) {
  const res = await fetch('/history-file/' + file);
  const text = await res.text();
  document.getElementById('modalTitle').textContent = file;
  document.getElementById('specContent').textContent = JSON.stringify(JSON.parse(text), null, 2);
  document.getElementById('specModal').classList.add('open');
}

function closeModal() {
  document.getElementById('specModal').classList.remove('open');
}

async function diffWith(fileA, fileB) {
  document.getElementById('diffTitle').textContent = fileA.replace('.json','') + '  →  ' + fileB.replace('.json','');
  document.getElementById('diffContent').innerHTML = '<p style="color:#64748b;font-family:monospace;padding:20px">Calcolo diff...</p>';
  document.getElementById('diffOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  const res = await fetch('/diff?a=' + encodeURIComponent(fileA) + '&b=' + encodeURIComponent(fileB));
  const html = await res.text();
  document.getElementById('diffContent').innerHTML = html;
}

function closeDiff() {
  document.getElementById('diffOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDiff(); }
});
</script>
</body>
</html>`;
}

// ── HTTP Server ───────────────────────────────

function serveFile(res, filePath, contentType) {
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");

  // Dashboard
  if (pathname === "/" || pathname === "/index.html") {
    const history = readHistory();
    const reports = readReports();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(dashboardHtml(history, reports));
    return;
  }

  // Serve report HTML
  if (pathname.startsWith("/reports/")) {
    const file = path.basename(pathname);
    serveFile(res, path.join(REPORTS_DIR, file), "text/html; charset=utf-8");
    return;
  }

  // Serve history file raw
  if (pathname.startsWith("/history-file/")) {
    const file = path.basename(pathname);
    serveFile(
      res,
      path.join(HISTORY_DIR, file),
      "application/json; charset=utf-8",
    );
    return;
  }

  // On-demand diff between two history files
  if (pathname === "/diff") {
    const fileA = url.searchParams.get("a");
    const fileB = url.searchParams.get("b");
    if (!fileA || !fileB) {
      res.writeHead(400);
      res.end("Missing params");
      return;
    }
    try {
      const oldSpec = JSON.parse(
        fs.readFileSync(path.join(HISTORY_DIR, path.basename(fileA)), "utf8"),
      );
      const newSpec = JSON.parse(
        fs.readFileSync(path.join(HISTORY_DIR, path.basename(fileB)), "utf8"),
      );
      const diffResult = compareSpecs(oldSpec, newSpec);
      const html = generateReport({
        ...diffResult,
        oldVersion: oldSpec?.info?.version || "old",
        newVersion: newSpec?.info?.version || "new",
        generatedAt: new Date().toLocaleString("it-IT"),
        specUrl: config.SPEC_URL,
      });
      // estrai solo il body dal report completo per inline embed
      const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
      const inner = bodyMatch ? bodyMatch[1] : html;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(inner);
    } catch (e) {
      res.writeHead(500);
      res.end("Errore: " + e.message);
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n  🌐  Dashboard:  http://localhost:${PORT}\n`);
  try {
    require("child_process").execSync(`open http://localhost:${PORT}`);
  } catch {}
});
