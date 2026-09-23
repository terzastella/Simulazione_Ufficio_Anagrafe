# ANAGR@FE — GUI desktop solo Windows

GUI nativa per il simulatore Ufficio Anagrafe di
[Ciuffetto288/Simulazione_Ufficio_Anagrafe](https://github.com/Ciuffetto288/Simulazione_Ufficio_Anagrafe).
Stack: **Tauri 2 + React + TypeScript**, solo Windows (`targets: ["nsis"]`).

Questo fork contiene **solo la GUI + rilievi**: la CLI Java resta nel repo originale.

## Download

Dalla pagina **[Releases](../../releases)**: `ANAGR@FE_1.0.0_x64-setup.exe` (~1,6 MB, niente JRE).

## Contenuto

```
anagrafe-gui/      # sorgenti GUI (vedi anagrafe-gui/README.md per build)
data/              # comuni.xlsx/csv di riferimento per il converter + esempio cittadini.csv
logo.jpeg          # sorgente icona exe
consiglio_fix.md   # rilievi sul codice upstream (inviati anche via PR all'autore)
license.md         # licenza originale (attribuzione)
```

## Build da sorgente

```powershell
cd anagrafe-gui
npm install
node scripts/convert-comuni.mjs
npm run tauri build
```

## Crediti

Logica, dati e licenza: `Ciuffetto288/Simulazione_Ufficio_Anagrafe`.
