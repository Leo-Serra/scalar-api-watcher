# api-watcher 🔍

Monitora automaticamente le spec OpenAPI/Scalar, mantiene uno storico delle versioni e genera report HTML delle differenze.

## Setup

```bash
cd api-watcher
npm install
```

## Configurazione

Apri `config.js` e imposta `SPEC_URL` con l'URL diretto alla spec raw (JSON o YAML):

```js
SPEC_URL: 'https://mia-api.com/openapi/admin.json',
```

> **Tip Scalar**: apri Scalar nel browser, poi DevTools → Network → ricarica la pagina e cerca la chiamata che restituisce il JSON della spec. Copia quell'URL esatto.

## Avvio

Servono due processi in parallelo — aprili in due tab del terminale:

```bash
# Terminale 1 — watcher (controlla ogni ora e salva le versioni)
npm start

# Terminale 2 — dashboard web su http://localhost:3456
npm run dashboard
```

Per test rapidi, imposta `CRON_SCHEDULE: '*/2 * * * *'` in `config.js` per controllare ogni 2 minuti.

## Dashboard web

Apri `http://localhost:3456` per:

- **Timeline versioni** — tutte le versioni salvate con hash, numero di endpoint e timestamp
- **Diff inline** — clicca "Diff con precedente" su qualsiasi versione per vedere le differenze nella stessa pagina
- **Confronto libero** — dropdown per confrontare qualsiasi coppia di versioni
- **Ispezione spec** — vedi il JSON raw di ogni versione salvata in un modal
- **Report storici** — tutti i report HTML generati automaticamente dal watcher

## Comandi da terminale

```bash
# Confronta le ultime due versioni salvate (apre report nel browser)
npm run diff

# Elenca tutte le versioni in history/
node src/cli-diff.js --list

# Confronta due file specifici
node src/cli-diff.js history/2024-01-01T10-00-00.json history/2024-01-01T11-00-00.json
```

## Struttura

```
api-watcher/
├── config.js               ← MODIFICA QUI
├── history/                ← versioni JSON salvate (solo quelle cambiate)
├── reports/                ← report HTML delle diff
└── src/
    ├── watcher.js          ← processo principale (cron)
    ├── dashboard.js        ← web UI su localhost:3456
    ├── diff-engine.js      ← motore di confronto
    ├── report-generator.js ← generatore HTML dei report
    └── cli-diff.js         ← tool manuale da terminale
```

## Come funziona

1. Ogni ora scarica le spec dall'URL configurato
2. Calcola un hash SHA-256 della spec
3. Se l'hash è uguale all'ultima versione salvata → non fa nulla
4. Se l'hash è diverso → salva la nuova versione in `history/` e genera un report HTML in `reports/`
5. Se `OPEN_REPORT_ON_CHANGE: true` → apre automaticamente il report nel browser

## Avvio automatico al login (macOS)

Per far girare il watcher sempre in background senza tenere il terminale aperto:

```bash
# Crea il file plist — sostituisci /PATH/TO con il path reale del progetto
# e verifica il path di node con: which node
cat > ~/Library/LaunchAgents/com.apiwatcher.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.apiwatcher</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/PATH/TO/api-watcher/src/watcher.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/PATH/TO/api-watcher</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/PATH/TO/api-watcher/watcher.log</string>
  <key>StandardErrorPath</key>
  <string>/PATH/TO/api-watcher/watcher-error.log</string>
</dict>
</plist>
EOF

# Attiva
launchctl load ~/Library/LaunchAgents/com.apiwatcher.plist

# Verifica che sia attivo
launchctl list | grep apiwatcher

# Per fermarlo
launchctl unload ~/Library/LaunchAgents/com.apiwatcher.plist
```

La dashboard invece si avvia manualmente quando serve con `npm run dashboard`.

## Opzioni config.js

| Chiave                  | Default       | Descrizione                                    |
| ----------------------- | ------------- | ---------------------------------------------- |
| `SPEC_URL`              | —             | URL diretto alla spec OpenAPI (JSON o YAML)    |
| `CRON_SCHEDULE`         | `'0 * * * *'` | Ogni ora — sintassi cron standard              |
| `HISTORY_DIR`           | `./history`   | Dove salvare le versioni                       |
| `REPORTS_DIR`           | `./reports`   | Dove salvare i report HTML                     |
| `OPEN_REPORT_ON_CHANGE` | `true`        | Apre il report nel browser ad ogni cambiamento |
| `MAX_HISTORY`           | `0`           | Versioni massime da tenere (0 = illimitato)    |
| `EXTRA_HEADERS`         | `{}`          | Header HTTP aggiuntivi (es. `Authorization`)   |
