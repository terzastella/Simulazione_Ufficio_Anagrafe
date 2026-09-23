# ANAGR@FE — GUI desktop (Windows)

GUI nativa per il simulatore Ufficio Anagrafe
([repo originale](https://github.com/Ciuffetto288/Simulazione_Ufficio_Anagrafe) di Ciuffetto288).
Stack: **Tauri 2 + React + TypeScript**. Solo Windows (`targets: ["nsis"]`).

La logica (codice fiscale con omocodia, ricerca comuni, CSV) è un port 1:1 del Java originale,
verificato contro `SelfTest` (`Mario Rossi, Roma 01/01/1980` → `RSSMRA80A01H501U`).
L'export storage a 8 campi è lo stesso `data/cittadini.csv` della CLI: i due programmi
restano interoperabili.

## Funzioni

Nuovo cittadino · Calcola CF · Archivio con ricerca · Verifica CF · Statistiche ·
Import/Export CSV · Temi dark (nero) / light / auto · 7904 comuni bundlati offline.

## Requisiti

Node 20+, Rust stabile, WebView2 (preinstallato su Windows 10/11).

## Sviluppo

```powershell
cd anagrafe-gui
npm install
node scripts/convert-comuni.mjs   # data/comuni.xlsx -> public/comuni.json + src-tauri/resources
npm run tauri dev
```

## Build installer

```powershell
npm run tauri build
# output: src-tauri/target/release/bundle/nsis/ANAGR@FE_1.0.0_x64-setup.exe
```

## Crediti

Logica e dati da `Ciuffetto288/Simulazione_Ufficio_Anagrafe` (vedi `license.md` upstream).
Rilievi sul codice originale in `consiglio_fix.md`.
