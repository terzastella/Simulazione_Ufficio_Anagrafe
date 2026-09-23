import { useEffect, useMemo, useRef, useState } from "react";
import {
  Comune, Cittadino, capitalizeWords, generaCF, verificaCF,
  findComune, searchComuni, toStorageLine, toCsvLine, fromStorageLine,
  splitCsvLine, formatIT, statistiche, birthRange, isValidBirthDate,
} from "./lib/anagrafe";
import "./App.css";

type View = "nuovo" | "calcola" | "archivio" | "verifica" | "statistiche" | "export";
type Theme = "dark" | "light" | "auto";
const LS_KEY = "anagrafe-cittadini-v1";
const LS_THEME = "anagrafe-theme";
const HEADER = "nome;cognome;dataNascita;sesso;comune;provincia;codiceComune;codiceFiscale";

const isTauri = () => "__TAURI_INTERNALS__" in window || "__TAURI__" in window;

async function loadComuni(): Promise<Comune[]> {
  // 1) public/comuni.json (dev + bundle), 2) resource dir via FS plugin
  try {
    const r = await fetch("comuni.json");
    if (r.ok) { const j = await r.json(); if (Array.isArray(j) && j.length) return j; }
  } catch { /* noop */ }
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const { resourceDir, join } = await import("@tauri-apps/api/path");
    const dir = await resourceDir();
    const txt = await readTextFile(await join(dir, "resources", "comuni.json"));
    const j = JSON.parse(txt); if (Array.isArray(j) && j.length) return j;
  } catch { /* noop */ }
  return [
    { n: "Roma", p: "RM", c: "H501" }, { n: "Milano", p: "MI", c: "F205" },
    { n: "Torino", p: "TO", c: "L219" }, { n: "Napoli", p: "NA", c: "F839" },
  ];
}

function loadArchivio(): Cittadino[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j;
    }
  } catch { /* noop */ }
  return [];
}

function Dropdown<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open ]);
  const cur = options.find((o) => o.value === value);
  return (
    <div className="dd" ref={ref}>
      <button type="button" className="dd-btn" aria-haspopup="listbox" aria-expanded={open}
        aria-label={label} onClick={() => { setOpen((o) => !o); setHi(Math.max(0, options.findIndex((o) => o.value === value))); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(options.length - 1, h + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (open) { onChange(options[hi].value); setOpen(false); } else setOpen(true); }
          else if (e.key === "Escape") setOpen(false);
        }}>
        <span>{cur?.label ?? value}</span><span className="chev">▾</span>
      </button>
      {open && (
        <ul role="listbox" className="dd-list" aria-label={label}>
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={o.value === value}
              className={`${i === hi ? "active" : ""} ${o.value === value ? "selected" : ""}`}
              onMouseEnter={() => setHi(i)}
              onClick={() => { onChange(o.value); setOpen(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { onChange(o.value); setOpen(false); } }}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("nuovo");
  const [comuni, setComuni] = useState<Comune[]>([]);
  const [cittadini, setCittadini] = useState<Cittadino[]>(loadArchivio);
  const [msg, setMsg] = useState("");

  // form nuovo / calcola
  const [nome, setNome] = useState(""); const [cognome, setCognome] = useState("");
  const [data, setData] = useState("1980-01-01"); const [sesso, setSesso] = useState<"M" | "F">("M");
  const [comuneQ, setComuneQ] = useState(""); const [provQ, setProvQ] = useState("");
  const [lastCF, setLastCF] = useState("");
  // archivio
  const [q, setQ] = useState("");
  // verifica
  const [cfIn, setCfIn] = useState(""); const [verRes, setVerRes] = useState<{ valid: boolean; messages: string[] } | null>(null);
  // tema dark / light / auto (segue OS)
  const [theme, setTheme] = useState<Theme>(() => {
    try { const t = localStorage.getItem(LS_THEME); if (t === "dark" || t === "light" || t === "auto") return t; } catch { /* noop */ }
    return "auto";
  });

  useEffect(() => { loadComuni().then(setComuni); }, []);
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(cittadini)); } catch { /* noop */ } }, [cittadini]);
  useEffect(() => {
    try { localStorage.setItem(LS_THEME, theme); } catch { /* noop */ }
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = theme === "auto" ? (mq.matches ? "light" : "dark") : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    if (theme === "auto") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const byCode = useMemo(() => {
    const m = new Map(comuni.map((c) => [c.c, c]));
    return (code: string) => m.get(code.toUpperCase());
  }, [comuni]);

  const sug = useMemo(() => (comuneQ.trim() ? searchComuni(comuni, comuneQ, provQ) : []), [comuni, comuneQ, provQ]);
  const exact = findComune(comuni, comuneQ, provQ);

  const filtered = useMemo(() => {
    const nq = q.trim().toUpperCase();
    if (!nq) return [...cittadini].sort((a, b) => a.cognome.localeCompare(b.cognome));
    return cittadini.filter((c) =>
      `${c.nome} ${c.cognome} ${c.codiceFiscale}`.toUpperCase().includes(nq));
  }, [cittadini, q]);

  function handleGenera(salva: boolean) {
    setMsg("");
    if (!nome.trim() || !cognome.trim() || !data) { setMsg("Nome, cognome e data sono obbligatori."); return; }
    if (!isValidBirthDate(data)) {
      const r = birthRange();
      setMsg(`Data fuori intervallo valido (${formatIT(r.min)} - ${formatIT(r.max)}).`);
      return;
    }
    const com = findComune(comuni, comuneQ, provQ);
    if (!com) { setMsg("Comune non trovato: usa i suggerimenti o controlla la provincia."); return; }
    try {
      const cf = generaCF(nome.trim(), cognome.trim(), data, sesso, com.c,
        new Set(cittadini.map((c) => c.codiceFiscale)));
      setLastCF(cf);
      if (salva) {
        const rec: Cittadino = {
          nome: capitalizeWords(nome), cognome: capitalizeWords(cognome), dataNascita: data,
          sesso, comune: com.n, provincia: com.p, codiceComune: com.c, codiceFiscale: cf,
        };
        setCittadini((p) => [...p, rec]);
        setMsg(`Salvato: ${rec.cognome} ${rec.nome} — ${cf}`);
        setNome(""); setCognome(""); setComuneQ(""); setProvQ("");
      } else setMsg(`Codice calcolato (non salvato): ${cf}`);
    } catch (e) { setMsg(`Errore: ${(e as Error).message}`); }
  }

  async function saveDownload(name: string, text: string) {
    if (isTauri()) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const p = await save({ defaultPath: name });
        if (p) { await writeTextFile(p, text); setMsg(`Esportato in: ${p}`); return; }
      } catch { /* fallback browser */ }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
    setMsg(`Scaricato: ${name}`);
  }

  async function importaCSV() {
    let text = "";
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const sel = await open({ multiple: false, filters: [{ name: "CSV", extensions: ["csv"] }] });
        if (typeof sel === "string") text = await readTextFile(sel);
      } catch { /* fallback */ }
    }
    if (!text) {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".csv";
      inp.onchange = async () => {
        const f = inp.files?.[0]; if (!f) return;
        doImport(await f.text());
      };
      inp.click(); return;
    }
    doImport(text);
  }
  function doImport(text: string) {
    const recs = text.split(/\r?\n/).map(fromStorageLine).filter((x): x is Cittadino => !!x);
    const ok = recs.filter((c) => isValidBirthDate(c.dataNascita));
    const bad = recs.length - ok.length;
    // supporta anche export 7 campi? no: solo storage 8 campi
    if (!recs.length) {
      // prova righe export CSV (7 campi, data IT)
      const alt: Cittadino[] = [];
      for (const l of text.split(/\r?\n/)) {
        if (!l.trim() || l.toLowerCase().startsWith("nome;")) continue;
        const p = splitCsvLine(l, ";");
        if (p.length >= 7) {
          const [gg, mm, yy] = (p[2] || "").split("/");
          alt.push({ nome: p[0], cognome: p[1], dataNascita: yy && mm && gg ? `${yy}-${mm}-${gg}` : p[2], sesso: (p[3] || "M")[0].toUpperCase() as "M" | "F", comune: p[4], provincia: p[5], codiceComune: "", codiceFiscale: p[6] });
        }
      }
      if (alt.length) {
        const okAlt = alt.filter((c) => isValidBirthDate(c.dataNascita));
        setCittadini(okAlt);
        setMsg(`Importati ${okAlt.length} record (da export).` + (alt.length - okAlt.length ? ` ${alt.length - okAlt.length} scartati: data fuori intervallo.` : ""));
        return;
      }
      setMsg("Nessun record valido nel file."); return;
    }
    setCittadini(ok);
    setMsg(`Importati ${ok.length} record.` + (bad ? ` ${bad} scartati: data di nascita fuori intervallo.` : ""));
  }

  const NAV: { id: View; label: string }[] = [
    { id: "nuovo", label: "＋ Nuovo cittadino" }, { id: "calcola", label: "◇ Calcola CF" },
    { id: "archivio", label: "▤ Archivio" }, { id: "verifica", label: "✓ Verifica CF" },
    { id: "statistiche", label: "↟ Statistiche" }, { id: "export", label: "⇄ Import / Export" },
  ];

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="logo.png" alt="ANAGR@FE" className="brand-logo" /> ANAGR@FE</div>
        <div className="sub">Comuni: {comuni.length} · Schede: {cittadini.length}</div>
        {NAV.map((n) => (
          <button key={n.id} className={view === n.id ? "on" : ""} onClick={() => { setView(n.id); setMsg(""); setVerRes(null); }}>{n.label}</button>
        ))}
        <div className="theme-switch" role="group" aria-label="Tema">
          {(["dark", "light", "auto"] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}
              title={t === "auto" ? "Segue il tema di sistema" : t === "dark" ? "Tema scuro" : "Tema chiaro"}>
              {t === "dark" ? "☾" : t === "light" ? "☀" : "◐"}
            </button>
          ))}
        </div>
        <div className="foot">GUI Tauri · CLI invariata<br />stesso cittadini.csv</div>
      </aside>
      <main className="main">
        {(view === "nuovo" || view === "calcola") && (
          <section className="card">
            <h2>{view === "nuovo" ? "Nuovo cittadino" : "Calcola codice fiscale"}</h2>
            <div className="grid">
              <label>Nome<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
              <label>Cognome<input value={cognome} onChange={(e) => setCognome(e.target.value)} /></label>
              <label>Nascita<input type="date" value={data} min={birthRange().min} max={birthRange().max} onChange={(e) => setData(e.target.value)} /></label>
              <label>Sesso<Dropdown value={sesso} label="Sesso"
                options={[{ value: "M", label: "M" }, { value: "F", label: "F" }]}
                onChange={setSesso} /></label>
              <label>Comune (anche “Roma (RM)”)<input value={comuneQ} onChange={(e) => setComuneQ(e.target.value)} placeholder="Roma (RM)" /></label>
              <label>Provincia<input value={provQ} onChange={(e) => setProvQ(e.target.value.toUpperCase())} placeholder="RM" maxLength={2} /></label>
            </div>
            {!!sug.length && !exact && (
              <div className="sug">{sug.slice(0, 8).map((c) => (
                <button key={c.c} onClick={() => { setComuneQ(c.n); setProvQ(c.p); }}>{c.n} ({c.p})</button>
              ))}</div>
            )}
            {exact && <div className="ok">Comune risolto: {exact.n} ({exact.p}) · {exact.c}</div>}
            <div className="row">
              <button className="primary" onClick={() => handleGenera(view === "nuovo")}>
                {view === "nuovo" ? "Salva cittadino" : "Calcola"}
              </button>
              {lastCF && <code className="cf">{lastCF}</code>}
            </div>
            {msg && <p className="msg">{msg}</p>}
          </section>
        )}
        {view === "archivio" && (
          <section className="card">
            <h2>Archivio cittadini</h2>
            <input className="search" placeholder="Cerca nome, cognome o CF…" value={q} onChange={(e) => setQ(e.target.value)} />
            <table>
              <thead><tr><th>Cognome</th><th>Nome</th><th>Nascita</th><th>S</th><th>Comune</th><th>CF</th><th></th></tr></thead>
              <tbody>{filtered.map((c) => (
                <tr key={c.codiceFiscale}>
                  <td>{c.cognome}</td><td>{c.nome}</td><td>{formatIT(c.dataNascita)}</td><td>{c.sesso}</td>
                  <td>{c.comune} ({c.provincia})</td><td><code>{c.codiceFiscale}</code></td>
                  <td><button onClick={() => { if (confirm(`Eliminare ${c.cognome} ${c.nome}?`)) setCittadini((p) => p.filter((x) => x.codiceFiscale !== c.codiceFiscale)); }}>✕</button></td>
                </tr>
              ))}</tbody>
            </table>
            {!filtered.length && <p className="msg">Nessun record.</p>}
          </section>
        )}
        {view === "verifica" && (
          <section className="card">
            <h2>Verifica codice fiscale</h2>
            <div className="row">
              <input className="search" value={cfIn} onChange={(e) => setCfIn(e.target.value.toUpperCase())} placeholder="RSSMRA80A01H501U" maxLength={16} />
              <button className="primary" onClick={() => setVerRes(verificaCF(cfIn, byCode))}>Verifica</button>
            </div>
            {verRes && (
              <div className={verRes.valid ? "ok" : "bad"}>
                <strong>{verRes.valid ? "VALIDO" : "NON VALIDO"}</strong>
                <ul>{verRes.messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
              </div>
            )}
          </section>
        )}
        {view === "statistiche" && (
          <section className="card"><h2>Statistiche</h2><pre>{statistiche(cittadini)}</pre></section>
        )}
        {view === "export" && (
          <section className="card">
            <h2>Import / Export</h2>
            <div className="row">
              <button onClick={() => saveDownload("cittadini.csv", HEADER + "\n" + cittadini.map(toStorageLine).join("\n"))}>⬇ Export storage CSV (8 campi)</button>
              <button onClick={() => saveDownload("anagrafe-export.csv", "nome;cognome;dataNascita;sesso;comune;provincia;codiceFiscale\n" + cittadini.map(toCsvLine).join("\n"))}>⬇ Export leggibile CSV (7 campi)</button>
              <button onClick={importaCSV}>⬆ Importa CSV</button>
              <button onClick={() => { if (confirm("Svuotare l'archivio?")) setCittadini([]); }}>✕ Svuota</button>
            </div>
            {msg && <p className="msg">{msg}</p>}
            <p className="hint">Lo storage a 8 campi è lo stesso di <code>data/cittadini.csv</code> della CLI Java: i due programmi restano interoperabili.</p>
          </section>
        )}
      </main>
    </div>
  );
}
