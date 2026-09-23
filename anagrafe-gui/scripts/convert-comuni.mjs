// Converte data/comuni.xlsx (o .csv) in anagrafe-gui/public/comuni.json + src-tauri/resources/comuni.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const outPublic = path.resolve(here, "..", "public", "comuni.json");
const outRes = path.resolve(here, "..", "src-tauri", "resources", "comuni.json");

const norm = (s) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

function fromCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(sep).map((h) => norm(h));
  let ni = 0, pi = 1, ci = 2;
  if (header.some((h) => h.includes("COMUNE") || h.includes("DENOMINAZIONE") || h.includes("NOME"))) {
    ni = header.findIndex((h) => h.includes("DENOMINAZIONE") || h === "COMUNE" || h.includes("NOME"));
    pi = header.findIndex((h) => h.includes("SIGLA") || h.includes("PROV"));
    ci = header.findIndex((h) => h.includes("CATASTALE") || h.includes("BELFIORE") || h.includes("CODICE"));
    lines.shift();
  }
  const out = [];
  for (const l of lines) {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
    if (c.length <= Math.max(ni, pi, ci)) continue;
    const code = (c[ci] || "").toUpperCase();
    if (!/^[A-Z][0-9]{3}$/.test(code)) continue;
    out.push({ n: c[ni], p: (c[pi] || "").toUpperCase(), c: code });
  }
  return out;
}

let comuni = [];
const xlsxPath = path.join(root, "data", "comuni.xlsx");
try {
  const XLSX = (await import("xlsx")).default;
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  // trova header
  let hi = -1, ni = 0, pi = 1, ci = 2;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const r = (rows[i] || []).map((x) => norm(String(x ?? "")));
    const hasCode = r.some((x) => x.includes("CATASTALE") || x.includes("BELFIORE"));
    const hasName = r.some((x) => x.includes("DENOMINAZIONE") || x === "COMUNE" || x.includes("NOME COMUNE"));
    if (hasCode && hasName) {
      hi = i;
      ni = r.findIndex((x) => x.includes("DENOMINAZIONE") || x === "COMUNE" || x.includes("NOME COMUNE"));
      pi = r.findIndex((x) => x.includes("SIGLA") || x === "PROV" || x === "PROVINCIA");
      ci = r.findIndex((x) => x.includes("CATASTALE") || x.includes("BELFIORE"));
      break;
    }
  }
  if (hi >= 0) {
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const code = String(r[ci] ?? "").trim().toUpperCase();
      if (!/^[A-Z][0-9]{3}$/.test(code)) continue;
      comuni.push({ n: String(r[ni] ?? "").trim(), p: String(r[pi] ?? "").trim().toUpperCase(), c: code });
    }
  }
  console.log(`XLSX: ${comuni.length} comuni`);
} catch (e) {
  console.log("XLSX non leggibile, fallback CSV:", e.message);
}
if (!comuni.length) {
  const csv = fs.readFileSync(path.join(root, "data", "comuni.csv"), "utf8");
  comuni = fromCsv(csv);
  console.log(`CSV fallback: ${comuni.length} comuni`);
}
// dedup per codice
const seen = new Map();
for (const c of comuni) if (!seen.has(c.c)) seen.set(c.c, c);
comuni = [...seen.values()];
fs.mkdirSync(path.dirname(outPublic), { recursive: true });
fs.mkdirSync(path.dirname(outRes), { recursive: true });
fs.writeFileSync(outPublic, JSON.stringify(comuni));
fs.writeFileSync(outRes, JSON.stringify(comuni));
console.log(`Scritti ${comuni.length} comuni -> public/comuni.json + src-tauri/resources/comuni.json`);
