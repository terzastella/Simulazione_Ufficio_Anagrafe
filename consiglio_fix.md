# consiglio_fix.md — Rilievi sul codice di `Simulazione_Ufficio_Anagrafe`

> Analisi statica + verifica eseguita su `main` (release 5.3.1).
> Ogni rilievo indica file e righe, severità, PoC e fix proposto con snippet.
> Nulla di tutto questo tocca la logica di calcolo del codice fiscale, verificata corretta.

## Legenda severità

- 🔴 Alta: dato errato o rischio concreto
- 🟡 Media: igiene / robustezza / sicurezza di contorno
- ⚪ Bassa: manutenibilità

---

## 🔴 F1 — Data di nascita senza controllo di intervallo

**File:** `src/ConsoleUtils.java:121-142` (`readDate`), `:149-183` (`readOptionalDate`), `src/DateUtils.java:26-51`

**Problema:** il parser valida solo formato e calendario (`STRICT` scarta `30/02` ma accetta `01/01/2222`).
Si può registrare un cittadino "nato nel 2222" e il codice fiscale generato risulta formalmente valido.

**PoC:** alla voce 1 inserire data `01/01/2222` → salvato senza errori.

**Fix proposto** (`DateUtils.java`, aggiungere):

```java
// nascita valida: da oggi meno 120 anni fino a oggi, estremi inclusi
public static boolean isValidBirthDate(LocalDate date) {
    if (date == null) {
        return false;
    }
    LocalDate today = LocalDate.now();
    return !date.isAfter(today) && !date.isBefore(today.minusYears(120));
}
public static String birthRangeLabel() {
    LocalDate today = LocalDate.now();
    return formatItalian(today.minusYears(120)) + " - " + formatItalian(today);
}
```

e in `readDate` / `readOptionalDate`, dopo il parse:

```java
if (date.isPresent() && DateUtils.isValidBirthDate(date.get())) {
    return date.get();
}
// messaggio distinto tra formato errato e data fuori intervallo
```

**Test proposti** (`SelfTest.java`): data futura rifiutata, `2222-01-01` rifiutato,
`oggi.minusYears(121)` rifiutato, `oggi.minusYears(120)` e `oggi` accettati.

---

## 🟡 F2 — Formula injection nell'export CSV

**File:** `src/ExportService.java:49-56` → `src/Cittadino.java` (`toCsvLine`), `src/StringUtils.java:75-80` (`csvEscape`)

**Problema:** `csvEscape` neutralizza solo separatori e virgolette, ma non le celle che iniziano
per `=`, `+`, `-`, `@`. Apert o il CSV in Excel/LibreOffice, una cella tipo `=CMD(...)` viene
interpretata come formula. È un vettore classico (OWASP CSV Injection): basta un cognome
craftato inserito da input.

**Fix proposto:** in `csvEscape` (o in un `csvSafe` dedicato all'export), prefissare con `'`
(o tab) le celle che iniziano per `= + - @` dopo eventuale trim, prima del quoting.

---

## 🟡 F3 — File `.class` committati in `src/`

**File:** `src/*.class` (18 file compilati nel repo)

**Problema:** artefatti di build versionati: diff rumorosi, conflitti frequenti, rischio di eseguire
bytecode non allineato ai sorgenti.

**Fix proposto:** aggiungere `.gitignore` con `*.class`, `build/`, `dist/`, `target/`, `node_modules/`;
rimuovere i `.class` tracciati (`git rm --cached src/*.class`); compilare sempre con
`javac -d build/classes src/*.java`.

---

## 🟡 F4 — Dati anagrafici in chiaro, senza backup

**File:** `data/cittadini.csv`, `src/ArchivioService.java`

**Problema:** nomi, date di nascita e codici fiscali in CSV non cifrato; nessun backup prima
della riscrittura intera del file (`save()` sovrascrive in place: un crash a metà = archivio perso).

**Fix proposto:** prima di ogni `save()`, copiare il CSV esistente in `data/backup/cittadini_<timestamp>.csv`
(con rotazione, es. ultimi 10). A tendere: valutare cifratura a riposo.

---

## ⚪ F5 — Struttura progetto: `default package`, niente build tool, README non allineato

**File:** `src/*.java` (nessuna dichiarazione `package`), root del repo, `README.md`

**Problemi:**
- Classi nel `default package`: impedisce riuso come libreria e JPMS futuro.
- Nessun Maven/Gradle: build manuale con `javac`, niente dipendenze/test gestiti.
- `README.md` cita `./run.sh` e `src/anagrafe/*.java`, ma nel repo non esiste `run.sh` e i sorgenti
  stanno in `src/*.java` (flat). Chi clona non riesce a partire seguendo il README.

**Fix proposto:** spostare i sorgenti in `src/main/java/anagrafe/` (o almeno `src/anagrafe/`),
`pom.xml` minimo con `maven-compiler-plugin`, allineare il README ai percorsi reali.

---

## ⚪ F6 — Nessun test automatico né CI

**File:** `src/SelfTest.java`

**Problema:** solo assert artigianali lanciati con `--self-test`; nessuna suite JUnit, nessuna
GitHub Action. Una regressione sul calcolo CF passa inosservata.

**Fix proposto:** JUnit 5 sui casi di `SelfTest` (incluso `RSSMRA80A01H501U` per Mario Rossi Roma
01/01/1980) + workflow che compila ed esegue i test a ogni push.

---

## ⚪ F7 — `ArchivioService`: riscrittura intera senza lock

**File:** `src/ArchivioService.java` (`save()`)

**Problema:** ok per volumi piccoli, ma due istanze concorrenti (o un kill a metà scrittura)
corrompono il CSV. Nessun file lock, nessuna scrittura atomica.

**Fix proposto:** scrivere su file temporaneo + `Files.move(ATOMIC_MOVE)`; valutare `FileLock`
se mai girerà multi-istanza.

---

## ✅ Nota positiva — XXE già mitigato

**File:** `src/ComuneService.java` (`parseXml`): `disallow-doctype-decl` + `setExpandEntityReferences(false)`.
Ottimo: il parser XLSX custom resta sicuro contro entity esterne. Da non rimuovere in futuri refactor.

---

## Contesto release

La release `5.3.1-Release` distribuisce `Anagr@fe_Setup.exe` (~357 MB, JRE bundlato) e `Anagrfe.pkg` per macOS.
Una GUI Tauri solo-Windows con core portato in TypeScript produce un installer NSIS da ~1,6 MB
e un portable da ~5 MB, senza JRE: vedi fork `ANAGRAFE-Windows-GUI`.
