# Consigli per migliorare il progetto

Ciao! Ho provato il tuo simulatore Anagrafe e mi piace molto. Usandolo ho notato
alcune cose che potresti migliorare — te le elenco dalla più importante in giù,
con parole semplici.

## 1. Si può inserire un anno di nascita impossibile (la più importante)

Se creo un cittadino e come data metto **01/01/2222**, il programma lo accetta senza
dire niente e calcola pure un codice fiscale valido. Basta distrarsi digitando l'anno
e l'archivio si riempie di dati sbagliati.

**Consiglio:** accetta solo date comprese tra 120 anni fa e oggi, e se l'utente scrive
altro mostra un messaggio tipo "Data non valida: deve essere tra … e …" e chiedi di
nuovo. Se vuoi ti passo il codice già pronto che ho scritto per questo controllo.

## 2. Attenzione ai nomi "strani" nell'export Excel

Se qualcuno inserisce un cognome che inizia per `=`, `+`, `-` o `@`, quando apri il CSV
esportato con Excel quel testo può venire eseguito come formula. È un trucco noto e
basta poco per proteggersi: prima di scrivere le celle nell'export, metti un apostrofo
davanti a quelle che iniziano con quei caratteri.

## 3. Nel repo ci sono file che non dovrebbero starci

Dentro `src/` ci sono anche i file `.class` (quelli che crea il compilatore). Meglio non
caricarli su GitHub: creano confusione e possono andare fuori sincrono coi sorgenti.
Basta un file `.gitignore` con dentro `*.class` e `build/`, e compilare con
`javac -d build/classes src/*.java`.

## 4. I dati sono salvati in chiaro e senza copia di sicurezza

L'archivio `cittadini.csv` contiene nomi e codici fiscali veri in testo libero, e a ogni
salvataggio il file viene riscritto da zero: se il programma si chiude nel mezzo, i dati
si possono perdere. Consiglio: prima di salvare, fai una copia del file in una cartella
`backup` con data e ora nel nome.

## 5. Piccole cose di ordine

- I file `.java` stanno tutti senza "pacchetto": se un giorno vuoi riusarli altrove
  diventa scomodo. Anche uno strumento come Maven aiuterebbe a compilare tutto con un
  comando solo.
- Il README parla di `run.sh` e di una cartella `src/anagrafe/`, ma nel repo non ci
  sono: chi scarica il progetto e segue le istruzioni si perde. Basta aggiornare i
  percorsi a quelli veri (`src/*.java`).
- I controlli automatici (`SelfTest`) si lanciano solo a mano: se aggiungi i test veri
  (JUnit) e un controllo automatico a ogni modifica, gli errori futuri saltano fuori
  subito.
- Se due copie del programma sono aperte insieme, possono rovinarsi il CSV a vicenda:
  in futuro si può scrivere prima su un file temporaneo e poi spostarlo.

## Una cosa che hai fatto bene

Il lettore del file Excel dei comuni è protetto contro un tipo di attacco chiamato XXE:
non tutti ci pensano, continua così e non toglierlo se riscrivi quella parte.

## La GUI per Windows

Nel mio fork ho creato anche una versione con finestra per soli Windows (leggera,
installer da ~1,6MB senza Java da installare): se ti piace l'idea dimmelo e te la
propongo a parte.
