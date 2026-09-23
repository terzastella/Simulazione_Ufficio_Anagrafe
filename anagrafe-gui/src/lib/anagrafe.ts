// Core ANAGR@FE portato da Java: StringUtils, CodiceFiscaleService, ComuneService, Cittadino, Statistiche.

export interface Comune { n: string; p: string; c: string; }
export interface Cittadino {
  nome: string; cognome: string; dataNascita: string; // ISO yyyy-mm-dd
  sesso: "M" | "F"; comune: string; provincia: string; codiceComune: string; codiceFiscale: string;
}

// ---------- StringUtils ----------
export const cleanName = (v: string): string =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");

export const normalizeSearch = (v: string): string =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

export function capitalizeWords(v: string): string {
  if (!v || !v.trim()) return "";
  return v.trim().toLowerCase().split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export function csvEscape(v: string): string {
  const s = v ?? "";
  const q = s.includes(";") || s.includes('"') || s.includes("\n") || s.includes(",");
  return q ? `"${s.replace(/"/g, '""')}"` : s;
}

export function splitCsvLine(line: string, sep = ";"): string[] {
  const cells: string[] = []; let cur = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (ch === sep && !quoted) { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur); return cells;
}

// ---------- Codice fiscale ----------
const MONTH_CODES: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "H", 7: "L", 8: "M", 9: "P", 10: "R", 11: "S", 12: "T" };
const MONTH_VALUES: Record<string, number> = Object.fromEntries(Object.entries(MONTH_CODES).map(([k, v]) => [v, Number(k)]));
const OMOCODIA: Record<string, string> = { "0": "L", "1": "M", "2": "N", "3": "P", "4": "Q", "5": "R", "6": "S", "7": "T", "8": "U", "9": "V" };
const OMOCODIA_REV: Record<string, string> = Object.fromEntries(Object.entries(OMOCODIA).map(([k, v]) => [v, k]));
const OMOCODIA_POS = [6, 7, 9, 10, 12, 13, 14];
const ODD: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  [1, 0, 5, 7, 9, 13, 15, 17, 19, 21].forEach((v, i) => (m[String(i)] = v));
  [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23]
    .forEach((v, i) => (m[String.fromCharCode(65 + i)] = v));
  return m;
})();
const EVEN: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i <= 9; i++) m[String(i)] = i;
  for (let i = 0; i < 26; i++) m[String.fromCharCode(65 + i)] = i;
  return m;
})();

function consVow(v: string): string {
  const c = cleanName(v); let cons = "", vow = "";
  for (const ch of c) "AEIOU".includes(ch) ? (vow += ch) : (cons += ch);
  return cons + vow + "XXX";
}
const codiceCognome = (c: string) => consVow(c).slice(0, 3);
function codiceNome(nome: string): string {
  const c = cleanName(nome); let cons = "", vow = "";
  for (const ch of c) "AEIOU".includes(ch) ? (vow += ch) : (cons += ch);
  if (cons.length >= 4) return cons[0] + cons[2] + cons[3];
  return (cons + vow + "XXX").slice(0, 3);
}
function codiceData(iso: string, sesso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  let day = d; if (sesso === "F") day += 40;
  return `${String(y % 100).padStart(2, "0")}${MONTH_CODES[m]}${String(day).padStart(2, "0")}`;
}
export function carattereControllo(first15: string): string {
  const v = first15.toUpperCase(); let sum = 0;
  for (let i = 0; i < v.length; i++) sum += (i + 1) % 2 === 1 ? ODD[v[i]] ?? 0 : EVEN[v[i]] ?? 0;
  return String.fromCharCode(65 + (sum % 26));
}
function decodeOmocodia(s: string): string {
  const a = s.split("");
  for (const p of OMOCODIA_POS) a[p] = OMOCODIA_REV[a[p]] ?? a[p];
  return a.join("");
}

export function generaCF(nome: string, cognome: string, iso: string, sesso: "M" | "F", codiceComune: string, esistenti: Set<string> = new Set()): string {
  const base15 = codiceCognome(cognome) + codiceNome(nome) + codiceData(iso, sesso) + codiceComune.toUpperCase();
  const base = base15 + carattereControllo(base15);
  if (!esistenti.has(base)) return base;
  for (const v of generaOmocodie(base)) if (!esistenti.has(v)) return v;
  throw new Error("Tutte le varianti omocodiche occupate");
}
export function generaOmocodie(cf: string): string[] {
  const c = cf.toUpperCase(); if (c.length !== 16) return [];
  const base15 = decodeOmocodia(c.slice(0, 15)); const out: string[] = [];
  for (let mask = 1; mask < 1 << OMOCODIA_POS.length; mask++) {
    const a = base15.split("");
    for (let bit = 0; bit < OMOCODIA_POS.length; bit++) {
      const pos = OMOCODIA_POS[OMOCODIA_POS.length - 1 - bit];
      if (mask & (1 << bit)) { if (/\d/.test(a[pos])) a[pos] = OMOCODIA[a[pos]]; }
    }
    const f15 = a.join(""); out.push(f15 + carattereControllo(f15));
  }
  return out;
}
export function verificaCF(cfRaw: string, byCode: (c: string) => Comune | undefined): { valid: boolean; messages: string[] } {
  const cf = (cfRaw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (cf.length !== 16) return { valid: false, messages: ["Lunghezza non valida: servono 16 caratteri."] };
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf))
    return { valid: false, messages: ["Formato non valido."] };
  const exp = carattereControllo(cf.slice(0, 15));
  if (cf[15] !== exp) return { valid: false, messages: [`Carattere di controllo errato: atteso ${exp}.`] };
  const msg = ["Checksum corretto."];
  const dec = decodeOmocodia(cf.slice(0, 15)) + cf[15];
  const month = MONTH_VALUES[dec[8]] ?? -1;
  if (month < 1) return { valid: false, messages: [...msg, "Mese non valido."] };
  const dayCode = Number(dec.slice(9, 11)); const day = dayCode > 40 ? dayCode - 40 : dayCode;
  const sesso = dayCode > 40 ? "F" : "M";
  const dim = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month];
  if (day < 1 || day > dim) return { valid: false, messages: [...msg, "Giorno non valido."] };
  msg.push(`Data coerente: giorno ${day}, mese ${month}, sesso ${sesso}.`);
  const cc = dec[11] + dec.slice(12, 15);
  const com = byCode(cc);
  if (!com) return { valid: false, messages: [...msg, `Codice comune ${cc} non in archivio.`] };
  msg.push(`Comune coerente: ${com.n} (${com.p}).`);
  if (dec.slice(0, 15) !== cf.slice(0, 15)) msg.push("Omocodia rilevata e decodificata.");
  return { valid: true, messages: msg };
}

// ---------- Comuni ----------
const normComune = (v: string) => normalizeSearch(v).replace(/[^A-Z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const compactComune = (v: string) => normComune(v).replace(/ /g, "");
export function parseComuneQuery(nome: string, prov: string): { nome: string; prov: string } {
  let n = (nome ?? "").trim(); let emb = "";
  let m = n.match(/^(.*?)[\s,;\-]*\(([A-Za-z]{2})\)\s*$/);
  if (m) { n = m[1].trim(); emb = m[2].toUpperCase(); }
  else { const t = n.match(/^(.*?)[\s,;\-]+([A-Za-z]{2})\s*$/); if (t && t[1].trim()) { n = t[1].trim(); emb = t[2].toUpperCase(); } }
  return { nome: n, prov: (prov ?? "").trim().toUpperCase() || emb };
}
export function findComune(list: Comune[], nome: string, prov: string): Comune | undefined {
  const q = parseComuneQuery(nome, prov);
  return list.find((c) => (normComune(c.n) === normComune(q.nome) || compactComune(c.n) === compactComune(q.nome))
    && (!q.prov || c.p === q.prov));
}
export function searchComuni(list: Comune[], query: string, prov = ""): Comune[] {
  const q = parseComuneQuery(query, prov);
  if (!q.nome.trim()) return [];
  const nn = normComune(q.nome), cc = compactComune(q.nome);
  if (!nn && !cc) return [];
  const score = (c: Comune) => {
    const a = normComune(c.n), b = compactComune(c.n);
    if (a === nn) return 0; if (cc && b === cc) return 1;
    if (a.startsWith(nn)) return 2; if (cc && b.startsWith(cc)) return 3; return 4;
  };
  return list.filter((c) => (!q.prov || c.p === q.prov) && (normComune(c.n).includes(nn) || (cc && compactComune(c.n).includes(cc))))
    .sort((x, y) => score(x) - score(y) || x.n.localeCompare(y.n)).slice(0, 20);
}

// ---------- Cittadino / CSV ----------
export const toStorageLine = (c: Cittadino) =>
  [c.nome, c.cognome, c.dataNascita, c.sesso, c.comune, c.provincia, c.codiceComune, c.codiceFiscale].map(csvEscape).join(";");
export const toCsvLine = (c: Cittadino) =>
  [c.nome, c.cognome, formatIT(c.dataNascita), c.sesso, c.comune, c.provincia, c.codiceFiscale].map(csvEscape).join(";");
export function fromStorageLine(line: string): Cittadino | null {
  if (!line || !line.trim() || line.toLowerCase().startsWith("nome;")) return null;
  const p = splitCsvLine(line, ";"); if (p.length < 8 || !p[2] || !p[3].trim()) return null;
  return { nome: p[0], cognome: p[1], dataNascita: p[2], sesso: p[3][0].toUpperCase() as "M" | "F", comune: p[4], provincia: p[5], codiceComune: p[6], codiceFiscale: p[7] };
}
export const formatIT = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return y && m && d ? `${d}/${m}/${y}` : iso; };
// Intervallo valido per una data di nascita: oggi - 120 anni ... oggi (ISO yyyy-mm-dd, confronto lessicografico)
export function birthRange(): { min: string; max: string } {
  const t = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const min = new Date(t); min.setFullYear(min.getFullYear() - 120);
  return { min: iso(min), max: iso(t) };
}
export const isValidBirthDate = (d: string) => { const r = birthRange(); return !!d && d >= r.min && d <= r.max; };
export function statistiche(list: Cittadino[]): string {
  if (!list.length) return "Archivio vuoto.";
  const m = list.filter((c) => c.sesso === "M").length, f = list.length - m;
  const ages = list.map((c) => new Date().getFullYear() - Number(c.dataNascita.slice(0, 4)));
  const avg = (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1);
  const perComune = new Map<string, number>();
  list.forEach((c) => perComune.set(`${c.comune} (${c.provincia})`, (perComune.get(`${c.comune} (${c.provincia})`) ?? 0) + 1));
  const top = [...perComune.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `  ${k}: ${v}`).join("\n");
  return `Totale: ${list.length}  (M: ${m}, F: ${f})\nEtà media: ${avg}\nTop comuni:\n${top}`;
}
