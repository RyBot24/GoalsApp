// ─────────────────────────────────────────────
// IMPORTS
// useState  → verwaltet Daten die sich ändern (z.B. welche Ansicht aktiv ist)
// useEffect → führt Code einmalig beim Start aus (z.B. Daten laden)
// ─────────────────────────────────────────────
import { useState, useEffect } from "react";

// Schlüssel unter dem alle App-Daten im localStorage gespeichert werden
const STORAGE_KEY = "goals-app-data-v2";

// Farbpalette – jedes neue Ziel / jede neue Routine bekommt automatisch die nächste Farbe
// bg = Hauptfarbe, light = dieselbe Farbe aber transparent (für Hintergründe)
const COLORS = [
  { bg: "#FF6B35", light: "#FF6B3520" },
  { bg: "#00C896", light: "#00C89620" },
  { bg: "#4A90E2", light: "#4A90E220" },
  { bg: "#F5A623", light: "#F5A62320" },
  { bg: "#BD10E0", light: "#BD10E020" },
  { bg: "#E84393", light: "#E8439320" },
];

// Leerer Startzustand wenn noch keine Daten gespeichert sind
// weeks ist neu (BA2+): speichert Wochentitel und Mottos pro KW
const defaultData = {
  goals: [],
  nextGoalId: 1,
  nextTaskId: 1,
  routines: [],
  nextRoutineId: 1,
  weeks: {}, // Format: { "2026-W14": { title: "...", motto: "..." } }
};


// ─────────────────────────────────────────────
// DATENSPEICHERUNG (Custom Hook)
// Lädt beim Start gespeicherte Daten aus localStorage.
// Speichert bei jeder Änderung automatisch.
// HINWEIS: localStorage ist Zwischenlösung bis Supabase eingebunden ist.
// ─────────────────────────────────────────────
function useData() {
  const [data, setData] = useState(defaultData);
  const [loaded, setLoaded] = useState(false); // false = Daten noch nicht geladen

  // Wird einmalig beim App-Start ausgeführt (leeres [] = kein erneutes Ausführen)
  useEffect(() => {
    try {
      const r = localStorage.getItem(STORAGE_KEY); // Daten als JSON-String lesen
      if (r) {
        const parsed = JSON.parse(r); // JSON-String zurück in Objekt umwandeln
        // Fehlende Felder absichern (falls alte Daten ohne routines/weeks existieren)
        setData({
          ...defaultData,
          ...parsed,
          routines: parsed.routines || [],
          nextRoutineId: parsed.nextRoutineId || 1,
          weeks: parsed.weeks || {},
        });
      }
    } catch {}
    setLoaded(true); // Laden abgeschlossen → App kann angezeigt werden
  }, []);

  // Speichert neuen Zustand gleichzeitig im React State (→ UI updated)
  // und im localStorage (→ bleibt nach Reload erhalten)
  const save = (d) => {
    setData(d);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}
  };

  return { data, save, loaded };
}


// ─────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────

// Heutiges Datum als YYYY-MM-DD String (z.B. "2026-04-01")
const todayStr = () => new Date().toISOString().split("T")[0];

// Aktuelle Kalenderwoche als "2026-W14"
// Berechnung nach ISO-Standard: Woche beginnt Montag, KW1 = Woche mit erstem Donnerstag
const getWeekKey = () => {
  const now = new Date();
  const day = now.getDay() || 7; // Sonntag (0) → 7, damit Montag = 1
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + 4 - day); // Donnerstag dieser Woche finden
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

// Wochennummer aus Key extrahieren: "2026-W14" → 14
const weekNumFromKey = (key) => parseInt(key.split("-W")[1]);

// Alle 7 Tage der aktuellen Woche als Array von YYYY-MM-DD Strings (Mo–So)
const thisWeekDays = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1); // Montag dieser Woche
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
};

// Prüft ob eine Routine heute schon abgehakt wurde
const isDoneToday = (logs) => (logs || []).includes(todayStr());

// Streak berechnen: wie viele Tage/Wochen in Folge wurde die Routine abgehakt?
// Bricht ab wenn gestern NICHT abgehakt wurde (bei täglichen Routinen)
const calcStreak = (logs, frequency) => {
  if (!logs || logs.length === 0) return 0;
  const sorted = [...logs].sort((a, b) => new Date(b) - new Date(a)); // neuestes zuerst

  if (frequency === "daily") {
    const t = todayStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    // Streak ist 0 wenn weder heute noch gestern abgehakt
    if (sorted[0] !== t && sorted[0] !== yesterday) return 0;
    let streak = 1, current = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const expected = new Date(new Date(current) - 86400000).toISOString().split("T")[0];
      if (sorted[i] === expected) { streak++; current = sorted[i]; } else break;
    }
    return streak;
  }
  // Wöchentlich: vereinfacht – Anzahl Einträge zählt als Streak
  return logs.length > 0 ? 1 : 0;
};

// Alle Tage eines Monats als YYYY-MM-DD Array
const getMonthDays = (year, month) => {
  const days = [];
  const n = new Date(year, month + 1, 0).getDate(); // letzter Tag des Monats
  for (let d = 1; d <= n; d++)
    days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return days;
};

// Wochentag des 1. eines Monats (0=So, 1=Mo... wird zu Mo=0 umgerechnet im Code)
const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();


// ─────────────────────────────────────────────
// WIEDERVERWENDBARE UI-KOMPONENTEN
// In React sind das "Bausteine" die überall eingesetzt werden können.
// ─────────────────────────────────────────────

// Halbtransparenter Overlay der den Hintergrund abdunkelt
// onClose → wird aufgerufen wenn der User außerhalb des Modals klickt
const Modal = ({ onClose, children }) => (
  <div onClick={onClose} style={{
    position: "fixed", inset: 0, background: "#0A0A0Fcc",
    backdropFilter: "blur(8px)", zIndex: 200,
    display: "flex", alignItems: "flex-end", justifyContent: "center"
  }}>
    {/* e.stopPropagation() verhindert dass Klicks im Inhalt das Modal schließen */}
    <div onClick={e => e.stopPropagation()} style={{
      background: "#13131A", borderRadius: "20px 20px 0 0",
      padding: "28px 24px 44px", width: "100%", maxWidth: 430,
      border: "1px solid #ffffff0a"
    }}>{children}</div>
  </div>
);

// Einheitliches Textfeld – style={} als Default verhindert Fehler wenn kein style übergeben wird
const Input = ({ style = {}, ...props }) => (
  <input style={{
    background: "#1E1E28", border: "1px solid #ffffff10", borderRadius: 10,
    padding: "12px 14px", color: "#E8E8F0", fontSize: 14, width: "100%",
    boxSizing: "border-box", outline: "none",
    fontFamily: "'DM Sans',sans-serif", marginBottom: 10, ...style
  }} {...props} />
);

// Mehrzeiliges Textfeld für Notizen
const Textarea = ({ style = {}, ...props }) => (
  <textarea style={{
    background: "#1E1E28", border: "1px solid #ffffff10", borderRadius: 10,
    padding: "12px 14px", color: "#E8E8F0", fontSize: 14, width: "100%",
    boxSizing: "border-box", outline: "none",
    fontFamily: "'DM Sans',sans-serif", marginBottom: 10,
    resize: "vertical", minHeight: 72, ...style
  }} {...props} />
);

// Einheitlicher Button – mit color = farbiger Hintergrund, ohne = weißer Hintergrund
const Btn = ({ color, children, style = {}, ...props }) => (
  <button style={{
    background: color || "#ffffff", color: color ? "#ffffff" : "#0A0A0F",
    border: "none", borderRadius: 10, padding: "13px 20px", fontSize: 13,
    fontWeight: 600, cursor: "pointer", letterSpacing: 0.3, ...style
  }} {...props}>{children}</button>
);

// Toggle-Buttons für Häufigkeitsauswahl (Täglich / Wöchentlich)
// value = aktuell ausgewählter Wert, onChange = Callback wenn gewechselt wird
const FreqToggle = ({ value, onChange }) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
    {["daily", "weekly"].map(f => (
      <button key={f} onClick={() => onChange(f)} style={{
        flex: 1, padding: "10px", borderRadius: 10, fontSize: 13,
        fontWeight: 600, cursor: "pointer", border: "none",
        background: value === f ? "#ffffff" : "#1E1E28", // aktiv = weiß, inaktiv = dunkel
        color: value === f ? "#0A0A0F" : "#ffffff40",
      }}>
        {f === "daily" ? "Täglich" : "Wöchentlich"}
      </button>
    ))}
  </div>
);


// ─────────────────────────────────────────────
// HAUPTKOMPONENTE
// Hier läuft alles zusammen. App verwaltet:
// – welche Ansicht gerade aktiv ist
// – welche Modals offen sind
// – alle Datenaktionen (hinzufügen, bearbeiten, löschen)
// ─────────────────────────────────────────────
export default function App() {
  const { data, save, loaded } = useData();

  // Aktuelle Ansicht: "dashboard" | "goal" | "routines" | "routineDetail"
  const [view, setView] = useState("dashboard");
  const [activeGoalId, setActiveGoalId] = useState(null);     // aktuell geöffnetes Ziel
  const [activeRoutineId, setActiveRoutineId] = useState(null); // aktuell geöffnete Routine

  // Welches Modal ist gerade offen (null = keins)
  const [modal, setModal] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);       // Ziel das gerade bearbeitet wird
  const [editingTask, setEditingTask] = useState(null);       // Aufgabe die gerade bearbeitet wird
  const [editingRoutine, setEditingRoutine] = useState(null); // Routine die gerade bearbeitet wird

  // Temporäre Formulardaten – werden beim Schließen zurückgesetzt
  const [form, setForm] = useState({});
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v })); // einzelnes Feld aktualisieren

  // Modal schließen + alle temporären Zustände zurücksetzen
  const closeModal = () => {
    setModal(null); setForm({});
    setEditingGoal(null); setEditingTask(null); setEditingRoutine(null);
  };

  // Ladebildschirm solange Daten noch nicht gelesen wurden
  if (!loaded) return (
    <div style={{ background: "#0A0A0F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#ffffff30", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 4 }}>LOADING</div>
    </div>
  );

  // ─── BERECHNETE WERTE ───
  const goals = data.goals || [];
  const routines = data.routines || [];
  const weeks = data.weeks || {};
  const currentWeekKey = getWeekKey();              // z.B. "2026-W14"
  const currentWeek = weeks[currentWeekKey] || null; // Wochentitel dieser Woche (oder null)

  const totalTasks = goals.reduce((a, g) => a + (g.tasks?.length || 0), 0);
  const doneTasks = goals.reduce((a, g) => a + (g.tasks?.filter(t => t.done)?.length || 0), 0);

  // Fortschritt eines Ziels in Prozent
  const progress = g => g.tasks?.length > 0
    ? Math.round((g.tasks.filter(t => t.done).length / g.tasks.length) * 100) : 0;

  const weekDays = thisWeekDays(); // Mo–So der aktuellen Woche

  // Nächste 5 offene Aufgaben mit Fälligkeitsdatum (über alle Ziele)
  const upcomingTasks = goals
    .flatMap(g => (g.tasks || []).filter(t => !t.done && t.due)
      .map(t => ({ ...t, goalTitle: g.title, goalColor: g.color })))
    .sort((a, b) => new Date(a.due) - new Date(b.due))
    .slice(0, 5);

  // Bester Streak über alle Routinen (für Stats-Kachel)
  const bestStreak = routines.length > 0
    ? Math.max(...routines.map(r => calcStreak(r.logs, r.frequency))) : 0;


  // ─── ZIEL-AKTIONEN ───

  const addGoal = () => {
    if (!form.title?.trim()) return;
    const color = COLORS[goals.length % COLORS.length]; // nächste Farbe im Kreis
    save({
      ...data, goals: [...goals, {
        id: data.nextGoalId, title: form.title.trim(),
        desc: form.desc?.trim() || "", deadline: form.deadline || "",
        color: color.bg, tasks: [], createdAt: new Date().toISOString()
      }], nextGoalId: data.nextGoalId + 1
    });
    closeModal();
  };

  const updateGoal = () => {
    if (!form.title?.trim()) return;
    // goals.map → ersetzt nur das Ziel mit passender ID, alle anderen bleiben gleich
    save({ ...data, goals: goals.map(g => g.id === editingGoal.id
      ? { ...g, title: form.title.trim(), desc: form.desc?.trim() || "", deadline: form.deadline || "" }
      : g) });
    closeModal();
  };

  const deleteGoal = (id) => {
    save({ ...data, goals: goals.filter(g => g.id !== id) });
    setView("dashboard"); setActiveGoalId(null);
  };


  // ─── AUFGABEN-AKTIONEN ───

  const addTask = (goalId) => {
    if (!form.title?.trim()) return;
    save({
      ...data, goals: goals.map(g => g.id === goalId ? {
        ...g, tasks: [...(g.tasks || []), {
          id: data.nextTaskId, title: form.title.trim(),
          notes: form.notes?.trim() || "", due: form.due || "",
          done: false, createdAt: new Date().toISOString()
        }]
      } : g), nextTaskId: data.nextTaskId + 1
    });
    closeModal();
  };

  const updateTask = (goalId) => {
    if (!form.title?.trim()) return;
    save({ ...data, goals: goals.map(g => g.id === goalId ? {
      ...g, tasks: g.tasks.map(t => t.id === editingTask.id
        ? { ...t, title: form.title.trim(), notes: form.notes?.trim() || "", due: form.due || "" }
        : t)
    } : g) });
    closeModal();
  };

  // Aufgabe abhaken / Haken entfernen
  // doneAt wird gespeichert → ermöglicht Wochenfortschritt-Anzeige
  const toggleTask = (goalId, taskId) => {
    save({ ...data, goals: goals.map(g => g.id === goalId ? {
      ...g, tasks: g.tasks.map(t => t.id === taskId
        ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null }
        : t)
    } : g) });
  };

  const deleteTask = (goalId, taskId) => {
    save({ ...data, goals: goals.map(g => g.id === goalId
      ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) } : g) });
  };

  // Aufgabe in der Liste nach oben (dir=-1) oder unten (dir=+1) verschieben
  const moveTask = (goalId, taskId, dir) => {
    const g = goals.find(g => g.id === goalId);
    const idx = g.tasks.findIndex(t => t.id === taskId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= g.tasks.length) return; // Grenzen prüfen
    const tasks = [...g.tasks];
    [tasks[idx], tasks[newIdx]] = [tasks[newIdx], tasks[idx]]; // Tausch via Destructuring
    save({ ...data, goals: goals.map(g => g.id === goalId ? { ...g, tasks } : g) });
  };


  // ─── ROUTINE-AKTIONEN ───

  const addRoutine = () => {
    if (!form.title?.trim()) return;
    const color = COLORS[routines.length % COLORS.length];
    save({
      ...data,
      routines: [...routines, {
        id: data.nextRoutineId, title: form.title.trim(),
        frequency: form.frequency || "daily",           // "daily" oder "weekly"
        goalId: form.goalId ? Number(form.goalId) : null, // verknüpftes Ziel (optional)
        color: color.bg,
        logs: [], // Array von YYYY-MM-DD Strings – an welchen Tagen abgehakt
        createdAt: new Date().toISOString()
      }],
      nextRoutineId: data.nextRoutineId + 1
    });
    closeModal();
  };

  const updateRoutine = () => {
    if (!form.title?.trim()) return;
    save({ ...data, routines: routines.map(r => r.id === editingRoutine.id
      ? { ...r, title: form.title.trim(), frequency: form.frequency || r.frequency, goalId: form.goalId ? Number(form.goalId) : null }
      : r) });
    closeModal();
  };

  const deleteRoutine = (id) => {
    save({ ...data, routines: routines.filter(r => r.id !== id) });
    setView("routines"); setActiveRoutineId(null);
  };

  // Routine für heute abhaken oder Haken entfernen (Toggle)
  const toggleRoutineToday = (routineId) => {
    const t = todayStr();
    save({ ...data, routines: routines.map(r => r.id === routineId ? {
      ...r, logs: r.logs.includes(t)
        ? r.logs.filter(d => d !== t) // bereits abgehakt → entfernen
        : [...r.logs, t]              // noch nicht abgehakt → hinzufügen
    } : r) });
  };


  // ─── WOCHEN-AKTIONEN ───

  // Wochentitel und Motto für die aktuelle Woche speichern
  const saveWeek = () => {
    if (!form.weekTitle?.trim()) return;
    save({
      ...data,
      weeks: {
        ...weeks,
        [currentWeekKey]: {
          title: form.weekTitle.trim(),
          motto: form.weekMotto?.trim() || "",
          createdAt: new Date().toISOString(),
        }
      }
    });
    closeModal();
  };

  const activeGoal = goals.find(g => g.id === activeGoalId);
  const activeRoutine = routines.find(r => r.id === activeRoutineId);

  // ─── STYLES ───
  // Alle Styles als JavaScript-Objekte (React-Weg statt CSS-Datei)
  const s = {
    app: { background: "#0A0A0F", minHeight: "100vh", fontFamily: "'DM Sans',sans-serif", color: "#E8E8F0", maxWidth: 430, margin: "0 auto", paddingBottom: 80 },
    header: { padding: "48px 24px 24px", borderBottom: "1px solid #ffffff0a" },
    label: { fontSize: 11, letterSpacing: 4, color: "#ffffff30", textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8 },
    h1: { fontSize: 28, fontWeight: 700, color: "#ffffff", letterSpacing: -0.5, lineHeight: 1.1 },
    // Fixierte Navigationsleiste unten
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#0A0A0F", borderTop: "1px solid #ffffff0a", display: "flex", zIndex: 100, padding: "12px 0 20px" },
    // a = active: aktiver Tab weiß, inaktiver fast unsichtbar
    navBtn: (a) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: a ? "#ffffff" : "#ffffff25", fontSize: 10, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }),
    card: (color) => ({ background: "#13131A", border: `1px solid ${color}25`, borderRadius: 16, padding: "20px", marginBottom: 12 }),
    pill: (color) => ({ display: "inline-block", background: `${color}20`, color: color, fontSize: 10, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", padding: "4px 10px", borderRadius: 20 }),
    progressBar: { height: 6, background: "#ffffff08", borderRadius: 4, marginTop: 12, overflow: "hidden" },
    progressFill: (pct, color) => ({ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.5s ease" }),
    // Fortschrittsring via conic-gradient: Kreisbogen je nach Prozentwert
    bigProgress: (pct, color) => ({ width: 80, height: 80, borderRadius: "50%", background: `conic-gradient(${color} ${pct * 3.6}deg, #1E1E28 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }),
    bigProgressInner: { width: 60, height: 60, borderRadius: "50%", background: "#13131A", display: "flex", alignItems: "center", justifyContent: "center" },
    // Wiederverwendbarer Card-Block für Dashboard-Sektionen
    block: { background: "#13131A", borderRadius: 14, padding: "16px", marginBottom: 16 },
  };


  // ─────────────────────────────────────────────
  // DASHBOARD ANSICHT (verbessert)
  // Zeigt: Wochentitel, Stats, 7-Tage Verlauf,
  //        Zielfortschritt, Routinen, Fälligkeiten, Archiv
  // ─────────────────────────────────────────────
  const Dashboard = () => {
    const weekNum = weekNumFromKey(currentWeekKey);
    return (
      <div>
        {/* ── Wochen-Hero ──
            Zeigt den Titel + Motto der aktuellen Woche.
            Wenn noch keiner gesetzt ist → orangener Hinweis zum Antippen */}
        <div style={{ padding: "40px 24px 24px", borderBottom: "1px solid #ffffff0a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={s.label}>KW {weekNum}</div>
              {currentWeek ? (
                <>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", lineHeight: 1.2, marginBottom: 6 }}>
                    {currentWeek.title}
                  </div>
                  {currentWeek.motto && (
                    <div style={{ fontSize: 13, color: "#ffffff40", fontStyle: "italic", lineHeight: 1.5 }}>
                      „{currentWeek.motto}"
                    </div>
                  )}
                </>
              ) : (
                // Erinnerung wenn noch kein Wochentitel gesetzt
                <div onClick={() => { setForm({ weekTitle: "", weekMotto: "" }); setModal("editWeek"); }}
                  style={{ cursor: "pointer", background: "#FF6B3510", border: "1px dashed #FF6B3540", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                  <div style={{ fontSize: 13, color: "#FF6B35", fontWeight: 600 }}>Woche noch ohne Titel</div>
                  <div style={{ fontSize: 11, color: "#FF6B3580", marginTop: 2 }}>Tippen um Titel + Motto zu setzen →</div>
                </div>
              )}
            </div>
            {/* Bearbeiten-Button – nur sichtbar wenn Wochentitel bereits gesetzt */}
            {currentWeek && (
              <button onClick={() => { setForm({ weekTitle: currentWeek.title, weekMotto: currentWeek.motto || "" }); setModal("editWeek"); }}
                style={{ background: "none", border: "none", color: "#ffffff20", cursor: "pointer", fontSize: 18, padding: "0 0 0 12px", flexShrink: 0 }}>✎</button>
            )}
          </div>
        </div>

        <div style={{ padding: "20px 24px 0" }}>

          {/* ── Stats-Kacheln ──
              Ziele gesamt | Erledigte Tasks | Bester Streak */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {[
              ["#FF6B35", goals.length, "Ziele"],
              ["#00C896", doneTasks, "Erledigt"],
              ["#F5A623", bestStreak, "Best Streak"],
            ].map(([c, n, l]) => (
              <div key={l} style={{ background: "#13131A", border: "1px solid #ffffff08", borderRadius: 12, padding: 16, flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: -1, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 9, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* ── Wochenfortschritt ──
              7 Balken Mo–So: grün wenn an dem Tag Tasks erledigt wurden.
              Darunter ein Gesamtbalken wie weit alle Tasks erledigt sind. */}
          {totalTasks > 0 && (
            <div style={s.block}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={s.label}>Diese Woche</div>
                <div style={{ fontSize: 12, color: "#ffffff40", fontFamily: "'DM Mono',monospace" }}>{doneTasks}/{totalTasks}</div>
              </div>
              {/* 7-Tage Balken */}
              <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
                {weekDays.map((day, i) => {
                  // Wie viele Tasks wurden an diesem Tag abgehakt? (doneAt gespeichert beim Toggle)
                  const doneOnDay = goals.reduce((a, g) =>
                    a + (g.tasks || []).filter(t => t.doneAt?.startsWith(day)).length, 0);
                  const isToday = day === todayStr();
                  const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
                  return (
                    <div key={day} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{
                        height: 32, borderRadius: 4, marginBottom: 4,
                        background: doneOnDay > 0 ? "#00C896" : isToday ? "#ffffff10" : "#ffffff05",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, color: doneOnDay > 0 ? "#ffffff" : "#ffffff20",
                        fontFamily: "'DM Mono',monospace", fontWeight: 600,
                      }}>
                        {doneOnDay > 0 ? doneOnDay : ""}
                      </div>
                      <div style={{ fontSize: 9, color: isToday ? "#ffffff60" : "#ffffff20", fontFamily: "'DM Mono',monospace" }}>
                        {dayNames[i]}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Gesamtfortschritt-Balken */}
              <div style={{ height: 4, background: "#ffffff08", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%`, background: "#00C896", borderRadius: 4, transition: "width 0.5s" }} />
              </div>
            </div>
          )}

          {/* ── Zielfortschritt ──
              Jedes Ziel als schlanker Fortschrittsbalken.
              Anklicken öffnet die Ziel-Detailansicht. */}
          {goals.length > 0 && (
            <div style={s.block}>
              <div style={{ ...s.label, marginBottom: 14 }}>Zielfortschritt</div>
              {goals.map(g => {
                const pct = progress(g);
                return (
                  <div key={g.id} style={{ marginBottom: 14, cursor: "pointer" }}
                    onClick={() => { setActiveGoalId(g.id); setView("goal"); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "#ffffff", fontWeight: 500 }}>{g.title}</span>
                      </div>
                      <span style={{ fontSize: 12, color: g.color, fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "#ffffff08", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: g.color, borderRadius: 4, transition: "width 0.5s" }} />
                    </div>
                  </div>
                );
              })}
              <Btn color="#FF6B35" style={{ width: "100%", marginTop: 4 }}
                onClick={() => { setForm({}); setModal("addGoal"); }}>+ Neues Ziel</Btn>
            </div>
          )}

          {/* Wenn noch keine Ziele vorhanden */}
          {goals.length === 0 && (
            <Btn color="#FF6B35" style={{ width: "100%", marginBottom: 16 }}
              onClick={() => { setForm({}); setModal("addGoal"); }}>+ Erstes Ziel anlegen</Btn>
          )}

          {/* ── Routinen heute ──
              Nur tägliche Routinen werden hier angezeigt.
              Checkboxen können direkt hier abgehakt werden. */}
          {routines.filter(r => r.frequency === "daily").length > 0 && (
            <div style={s.block}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={s.label}>Routinen heute</div>
                {/* Zähler: X/Y erledigt */}
                <div style={{ fontSize: 11, color: "#ffffff25", fontFamily: "'DM Mono',monospace" }}>
                  {routines.filter(r => r.frequency === "daily" && isDoneToday(r.logs)).length}/
                  {routines.filter(r => r.frequency === "daily").length}
                </div>
              </div>
              {routines.filter(r => r.frequency === "daily").map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #ffffff06" }}>
                  {/* Checkbox – Klick hakt ab ohne zur Detailseite zu wechseln */}
                  <div onClick={() => toggleRoutineToday(r.id)} style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                    border: `2px solid ${isDoneToday(r.logs) ? r.color : "#ffffff15"}`,
                    background: isDoneToday(r.logs) ? r.color : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s"
                  }}>
                    {isDoneToday(r.logs) && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
                  </div>
                  <div style={{ flex: 1, fontSize: 13 }}>{r.title}</div>
                  {/* Streak-Anzeige – Farbe der Routine wenn aktiv, sonst grau */}
                  <div style={{ fontSize: 13, color: calcStreak(r.logs, r.frequency) > 0 ? r.color : "#ffffff15", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>
                    🔥 {calcStreak(r.logs, r.frequency)}
                  </div>
                </div>
              ))}
              <button onClick={() => setView("routines")}
                style={{ background: "none", border: "none", color: "#ffffff20", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", cursor: "pointer", marginTop: 10, padding: 0 }}>
                Alle Routinen →
              </button>
            </div>
          )}

          {/* ── Nächste Fälligkeiten ──
              Die 5 nächsten offenen Aufgaben mit Datum, über alle Ziele hinweg */}
          {upcomingTasks.length > 0 && (
            <div style={s.block}>
              <div style={{ ...s.label, marginBottom: 12 }}>Nächste Fälligkeiten</div>
              {upcomingTasks.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #ffffff06" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.goalColor, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "#ffffff30", fontFamily: "'DM Mono',monospace" }}>{t.goalTitle}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#ffffff30", fontFamily: "'DM Mono',monospace" }}>
                    {new Date(t.due).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Wochenarchiv ──
              Vergangene Wochen mit Titel und Motto.
              Wird nur angezeigt wenn mindestens eine vergangene Woche gespeichert ist. */}
          {Object.keys(weeks).filter(k => k !== currentWeekKey).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...s.label, marginBottom: 12 }}>Wochenarchiv</div>
              {Object.entries(weeks)
                .filter(([key]) => key !== currentWeekKey) // aktuelle Woche ausblenden
                .sort(([a], [b]) => b.localeCompare(a))    // neueste zuerst
                .slice(0, 5)                                // max. 5 anzeigen
                .map(([key, w]) => (
                  <div key={key} style={{ padding: "10px 0", borderBottom: "1px solid #ffffff06" }}>
                    <div style={{ fontSize: 10, color: "#ffffff20", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 2 }}>
                      KW {weekNumFromKey(key)}
                    </div>
                    <div style={{ fontSize: 13, color: "#ffffff60", fontWeight: 600 }}>{w.title}</div>
                    {w.motto && <div style={{ fontSize: 11, color: "#ffffff25", fontStyle: "italic", marginTop: 2 }}>„{w.motto}"</div>}
                  </div>
                ))}
            </div>
          )}

        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────────
  // ZIEL-DETAILANSICHT
  // Zeigt alle Aufgaben eines Ziels mit Sortierung,
  // Notizen, verknüpfte Routinen, Edit & Delete
  // ─────────────────────────────────────────────
  const GoalView = () => {
    const [expandedTask, setExpandedTask] = useState(null); // welche Aufgabe ist aufgeklappt
    if (!activeGoal) return null;
    const pct = progress(activeGoal);
    const tasks = activeGoal.tasks || [];
    // Routinen die mit diesem Ziel verknüpft sind
    const linkedRoutines = routines.filter(r => r.goalId === activeGoal.id);

    return (
      <div>
        {/* Header mit farbigem linken Rand, Ziel-Info und Fortschrittsring */}
        <div style={{ ...s.header, borderLeft: `3px solid ${activeGoal.color}` }}>
          <button onClick={() => { setView("dashboard"); setActiveGoalId(null); }}
            style={{ background: "none", border: "none", color: "#ffffff40", cursor: "pointer", fontSize: 12, letterSpacing: 3, fontFamily: "'DM Mono',monospace", padding: 0, marginBottom: 16, textTransform: "uppercase" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={s.label}>Goal</div>
              <div style={s.h1}>{activeGoal.title}</div>
              {activeGoal.desc && <div style={{ fontSize: 13, color: "#ffffff40", marginTop: 6 }}>{activeGoal.desc}</div>}
              {activeGoal.deadline && <div style={{ fontSize: 11, color: "#ffffff25", fontFamily: "'DM Mono',monospace", marginTop: 8 }}>
                Due {new Date(activeGoal.deadline).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}
              </div>}
            </div>
            {/* Fortschrittsring */}
            <div style={s.bigProgress(pct, activeGoal.color)}>
              <div style={s.bigProgressInner}>
                <span style={{ fontSize: 13, fontWeight: 700, color: activeGoal.color }}>{pct}%</span>
              </div>
            </div>
          </div>
          <div style={{ ...s.progressBar, marginTop: 16 }}><div style={s.progressFill(pct, activeGoal.color)} /></div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Verknüpfte Routinen */}
          {linkedRoutines.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ ...s.label, marginBottom: 12 }}>Verknüpfte Routinen</div>
              {linkedRoutines.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #ffffff06" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13 }}>{r.title}</div>
                  <span style={s.pill(r.color)}>{r.frequency === "daily" ? "täglich" : "wöchentlich"}</span>
                  <div style={{ fontSize: 11, color: r.color, fontFamily: "'DM Mono',monospace" }}>🔥 {calcStreak(r.logs, r.frequency)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Aufgaben-Header mit Zähler und Edit/Delete-Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={s.label}>Tasks ({tasks.filter(t => t.done).length}/{tasks.length})</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { setForm({ title: activeGoal.title, desc: activeGoal.desc, deadline: activeGoal.deadline }); setEditingGoal(activeGoal); setModal("editGoal"); }}
                style={{ background: "none", border: "none", color: "#ffffff40", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>Edit</button>
              <button onClick={() => deleteGoal(activeGoal.id)}
                style={{ background: "none", border: "none", color: "#ff444440", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>Delete</button>
            </div>
          </div>

          {tasks.length === 0 && <div style={{ color: "#ffffff20", fontSize: 13, padding: "20px 0" }}>Noch keine Tasks.</div>}

          {tasks.map((t, i) => (
            <div key={t.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #ffffff06", opacity: t.done ? 0.45 : 1 }}>
                {/* Reihenfolge-Pfeile */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => moveTask(activeGoal.id, t.id, -1)} disabled={i === 0}
                    style={{ background: "none", border: "none", color: i === 0 ? "#ffffff08" : "#ffffff25", cursor: i === 0 ? "default" : "pointer", padding: "2px 4px", fontSize: 10, lineHeight: 1 }}>▲</button>
                  <button onClick={() => moveTask(activeGoal.id, t.id, 1)} disabled={i === tasks.length - 1}
                    style={{ background: "none", border: "none", color: i === tasks.length - 1 ? "#ffffff08" : "#ffffff25", cursor: i === tasks.length - 1 ? "default" : "pointer", padding: "2px 4px", fontSize: 10, lineHeight: 1 }}>▼</button>
                </div>
                {/* Checkbox */}
                <div onClick={() => toggleTask(activeGoal.id, t.id)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${t.done ? activeGoal.color : "#ffffff15"}`, background: t.done ? activeGoal.color : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {t.done && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
                </div>
                {/* Titel – Klick klappt Notizen auf/zu */}
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedTask(expandedTask === t.id ? null : t.id)}>
                  <div style={{ fontSize: 14, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    {t.due && <span style={{ fontSize: 11, color: "#ffffff30", fontFamily: "'DM Mono',monospace" }}>
                      {new Date(t.due).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                    </span>}
                    {t.notes && <span style={{ fontSize: 11, color: "#ffffff25" }}>📝</span>}
                  </div>
                </div>
                <button onClick={() => { setForm({ title: t.title, notes: t.notes || "", due: t.due || "" }); setEditingTask(t); setModal("editTask"); }}
                  style={{ background: "none", border: "none", color: "#ffffff25", cursor: "pointer", fontSize: 13, padding: 4 }}>✎</button>
                <button onClick={() => deleteTask(activeGoal.id, t.id)}
                  style={{ background: "none", border: "none", color: "#ffffff15", cursor: "pointer", fontSize: 16, padding: 4 }}>×</button>
              </div>
              {/* Aufgeklappte Notizen */}
              {expandedTask === t.id && t.notes && (
                <div style={{ background: "#1E1E28", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "#ffffff60", lineHeight: 1.6 }}>{t.notes}</div>
              )}
            </div>
          ))}
          <Btn color={activeGoal.color} style={{ width: "100%", marginTop: 16 }}
            onClick={() => { setForm({}); setModal("addTask"); }}>+ Add Task</Btn>
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────────
  // ROUTINEN-ÜBERSICHT
  // Listet alle Routinen auf, getrennt nach täglich/wöchentlich
  // ─────────────────────────────────────────────
  const RoutinesView = () => (
    <div>
      <div style={s.header}>
        <div style={s.label}>Gewohnheiten</div>
        <div style={s.h1}>Routinen</div>
        {routines.filter(r => r.frequency === "daily").length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#ffffff40" }}>
            Heute: {routines.filter(r => r.frequency === "daily" && isDoneToday(r.logs)).length}/
            {routines.filter(r => r.frequency === "daily").length} erledigt
          </div>
        )}
      </div>
      <div style={{ padding: "20px 24px 0" }}>
        {routines.filter(r => r.frequency === "daily").length > 0 && (
          <>
            <div style={{ ...s.label, marginBottom: 12 }}>Täglich</div>
            {routines.filter(r => r.frequency === "daily").map(r => <RoutineCard key={r.id} routine={r} />)}
          </>
        )}
        {routines.filter(r => r.frequency === "weekly").length > 0 && (
          <>
            <div style={{ ...s.label, marginBottom: 12, marginTop: 8 }}>Wöchentlich</div>
            {routines.filter(r => r.frequency === "weekly").map(r => <RoutineCard key={r.id} routine={r} />)}
          </>
        )}
        {routines.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#ffffff20", fontSize: 13 }}>Noch keine Routinen.</div>
        )}
        <Btn color="#00C896" style={{ width: "100%", marginTop: 8 }}
          onClick={() => { setForm({ frequency: "daily" }); setModal("addRoutine"); }}>
          + Neue Routine
        </Btn>
      </div>
    </div>
  );

  // Einzelne Routine-Karte mit Checkbox, Streak und Mini-Heatmap (letzte 7 Tage)
  const RoutineCard = ({ routine: r }) => {
    const streak = calcStreak(r.logs, r.frequency);
    const done = isDoneToday(r.logs);
    const linkedGoal = goals.find(g => g.id === r.goalId);
    // Letzte 7 Tage für Mini-Heatmap
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
    return (
      <div style={{ ...s.card(r.color), cursor: "pointer" }}
        onClick={() => { setActiveRoutineId(r.id); setView("routineDetail"); }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Check-Button – stopPropagation verhindert dass der Klick auch die Detailseite öffnet */}
          <div onClick={e => { e.stopPropagation(); toggleRoutineToday(r.id); }}
            style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, cursor: "pointer", border: `2px solid ${done ? r.color : "#ffffff15"}`, background: done ? r.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
            {done
              ? <svg width="14" height="11" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
              : <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, opacity: 0.4 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#ffffff", marginBottom: 2 }}>{r.title}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={s.pill(r.color)}>{r.frequency === "daily" ? "täglich" : "wöchentlich"}</span>
              {linkedGoal && <span style={{ fontSize: 11, color: "#ffffff30" }}>→ {linkedGoal.title}</span>}
            </div>
          </div>
          {/* Streak-Zähler */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: streak > 0 ? r.color : "#ffffff15", lineHeight: 1 }}>{streak}</div>
            <div style={{ fontSize: 9, color: "#ffffff25", fontFamily: "'DM Mono',monospace", letterSpacing: 2 }}>STREAK</div>
          </div>
        </div>
        {/* Mini-Heatmap: 7 Balken für die letzten 7 Tage */}
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {last7.map(day => (
            <div key={day} style={{ flex: 1, height: 6, borderRadius: 3, background: r.logs.includes(day) ? r.color : "#ffffff08" }} />
          ))}
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────────
  // ROUTINE-DETAILANSICHT
  // Zeigt Monatskalender + Stats + Edit/Delete
  // Vergangene Tage können nachträglich angeklickt werden
  // ─────────────────────────────────────────────
  const RoutineDetailView = () => {
    if (!activeRoutine) return null;
    const streak = calcStreak(activeRoutine.logs, activeRoutine.frequency);
    const linkedGoal = goals.find(g => g.id === activeRoutine.goalId);
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const monthDays = getMonthDays(year, month);
    const firstDay = (firstDayOfMonth(year, month) + 6) % 7; // Montag = 0
    const monthName = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const totalDone = activeRoutine.logs.length;
    const thisMonthDone = activeRoutine.logs.filter(d =>
      d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length;

    return (
      <div>
        <div style={{ ...s.header, borderLeft: `3px solid ${activeRoutine.color}` }}>
          <button onClick={() => { setView("routines"); setActiveRoutineId(null); }}
            style={{ background: "none", border: "none", color: "#ffffff40", cursor: "pointer", fontSize: 12, letterSpacing: 3, fontFamily: "'DM Mono',monospace", padding: 0, marginBottom: 16, textTransform: "uppercase" }}>← Back</button>
          <div style={s.label}>Routine</div>
          <div style={s.h1}>{activeRoutine.title}</div>
          {linkedGoal && <div style={{ fontSize: 13, color: "#ffffff40", marginTop: 6 }}>→ {linkedGoal.title}</div>}
          {/* Stats: Streak | Diesen Monat | Gesamt */}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {[
              [activeRoutine.color, streak, "Streak"],
              ["#4A90E2", thisMonthDone, "Diesen Monat"],
              ["#00C896", totalDone, "Gesamt"],
            ].map(([c, n, l]) => (
              <div key={l} style={{ background: "#1E1E28", borderRadius: 10, padding: "12px 8px", flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 9, color: "#ffffff25", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Heute abhaken / Haken entfernen */}
          <Btn
            color={isDoneToday(activeRoutine.logs) ? "#ffffff15" : activeRoutine.color}
            style={{ width: "100%", marginBottom: 24 }}
            onClick={() => toggleRoutineToday(activeRoutine.id)}>
            {isDoneToday(activeRoutine.logs) ? "✓ Heute erledigt" : "Heute abhaken"}
          </Btn>

          {/* Monatskalender als 7-Spalten-Grid (Mo–So)
              Anklicken von vergangenen Tagen fügt diese zum Log hinzu */}
          <div style={{ ...s.label, marginBottom: 12 }}>{monthName}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 24 }}>
            {/* Wochentag-Header */}
            {weekdays.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#ffffff20", fontFamily: "'DM Mono',monospace", paddingBottom: 4 }}>{d}</div>
            ))}
            {/* Leere Felder vor dem 1. des Monats */}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {/* Tage des Monats */}
            {monthDays.map(day => {
              const isToday = day === todayStr();
              const isDone = activeRoutine.logs.includes(day);
              return (
                <div key={day} onClick={() => {
                  // Nur vergangene Tage und heute können angeklickt werden
                  if (day <= todayStr()) {
                    save({ ...data, routines: routines.map(r => r.id === activeRoutine.id ? {
                      ...r, logs: r.logs.includes(day)
                        ? r.logs.filter(d => d !== day)
                        : [...r.logs, day]
                    } : r) });
                  }
                }} style={{
                  aspectRatio: "1", borderRadius: 6, cursor: "pointer",
                  background: isDone ? activeRoutine.color : isToday ? "#ffffff10" : "transparent",
                  border: isToday ? `1px solid ${activeRoutine.color}` : "1px solid transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontFamily: "'DM Mono',monospace",
                  color: isDone ? "#ffffff" : isToday ? "#ffffff" : "#ffffff30",
                  transition: "all 0.1s"
                }}>
                  {parseInt(day.split("-")[2])}
                </div>
              );
            })}
          </div>

          {/* Bearbeiten und Löschen */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setForm({ title: activeRoutine.title, frequency: activeRoutine.frequency, goalId: activeRoutine.goalId || "" }); setEditingRoutine(activeRoutine); setModal("editRoutine"); }}
              style={{ flex: 1, background: "#1E1E28", border: "none", borderRadius: 10, padding: "12px", color: "#ffffff60", fontSize: 13, cursor: "pointer" }}>Bearbeiten</button>
            <button onClick={() => deleteRoutine(activeRoutine.id)}
              style={{ flex: 1, background: "#1E1E28", border: "none", borderRadius: 10, padding: "12px", color: "#ff444460", fontSize: 13, cursor: "pointer" }}>Löschen</button>
          </div>
        </div>
      </div>
    );
  };


  // ─────────────────────────────────────────────
  // HAUPT-RENDER
  // Entscheidet welche Ansicht angezeigt wird.
  // Navigation + alle Modals sind immer sichtbar.
  // ─────────────────────────────────────────────
  return (
    <>
      {/* Google Fonts: DM Sans (Fließtext) + DM Mono (Labels) */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={s.app}>
        {/* Ansicht wechseln je nach State */}
        {view === "dashboard" && <Dashboard />}
        {view === "goal" && <GoalView />}
        {view === "routines" && <RoutinesView />}
        {view === "routineDetail" && <RoutineDetailView />}

        {/* Untere Navigationsleiste – 3 Tabs */}
        <nav style={s.nav}>
          <button style={s.navBtn(view === "dashboard" || view === "goal")} onClick={() => setView("dashboard")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
            Home
          </button>
          <button style={s.navBtn(false)} onClick={() => { setForm({}); setModal("addGoal"); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
            Add
          </button>
          <button style={s.navBtn(view === "routines" || view === "routineDetail")} onClick={() => setView("routines")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            Routines
          </button>
        </nav>


        {/* ─── MODALS ─── */}

        {/* Neues Ziel anlegen */}
        {modal === "addGoal" && (
          <Modal onClose={closeModal}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Neues Ziel</div>
            <Input placeholder="Titel" value={form.title || ""} onChange={e => setF("title", e.target.value)} />
            <Input placeholder="Beschreibung (optional)" value={form.desc || ""} onChange={e => setF("desc", e.target.value)} />
            <Input type="date" value={form.deadline || ""} onChange={e => setF("deadline", e.target.value)} />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn>
              <Btn color="#FF6B35" style={{ flex: 2 }} onClick={addGoal}>Anlegen</Btn>
            </div>
          </Modal>
        )}

        {/* Bestehendes Ziel bearbeiten */}
        {modal === "editGoal" && editingGoal && (
          <Modal onClose={closeModal}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Ziel bearbeiten</div>
            <Input placeholder="Titel" value={form.title || ""} onChange={e => setF("title", e.target.value)} />
            <Input placeholder="Beschreibung" value={form.desc || ""} onChange={e => setF("desc", e.target.value)} />
            <Input type="date" value={form.deadline || ""} onChange={e => setF("deadline", e.target.value)} />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn>
              <Btn color={editingGoal.color} style={{ flex: 2 }} onClick={updateGoal}>Speichern</Btn>
            </div>
          </Modal>
        )}

        {/* Neue Aufgabe hinzufügen */}
        {modal === "addTask" && activeGoal && (
          <Modal onClose={closeModal}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Neuer Task</div>
            <Input placeholder="Titel" value={form.title || ""} onChange={e => setF("title", e.target.value)} />
            <Textarea placeholder="Notizen (optional)" value={form.notes || ""} onChange={e => setF("notes", e.target.value)} />
            <Input type="date" value={form.due || ""} onChange={e => setF("due", e.target.value)} />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn>
              <Btn color={activeGoal.color} style={{ flex: 2 }} onClick={() => addTask(activeGoal.id)}>Hinzufügen</Btn>
            </div>
          </Modal>
        )}

        {/* Aufgabe bearbeiten */}
        {modal === "editTask" && editingTask && activeGoal && (
          <Modal onClose={closeModal}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Task bearbeiten</div>
            <Input placeholder="Titel" value={form.title || ""} onChange={e => setF("title", e.target.value)} />
            <Textarea placeholder="Notizen" value={form.notes || ""} onChange={e => setF("notes", e.target.value)} />
            <Input type="date" value={form.due || ""} onChange={e => setF("due", e.target.value)} />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn>
              <Btn color={activeGoal.color} style={{ flex: 2 }} onClick={() => updateTask(activeGoal.id)}>Speichern</Btn>
            </div>
          </Modal>
        )}

        {/* Neue Routine anlegen */}
        {modal === "addRoutine" && (
          <Modal onClose={closeModal}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Neue Routine</div>
            <Input placeholder="Name (z.B. Morgenrunde, Lesen)" value={form.title || ""} onChange={e => setF("title", e.target.value)} />
            <div style={{ fontSize: 11, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>Häufigkeit</div>
            <FreqToggle value={form.frequency || "daily"} onChange={v => setF("frequency", v)} />
            {goals.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8, marginTop: 4 }}>
                  Mit Ziel verknüpfen (optional)
                </div>
                <select value={form.goalId || ""} onChange={e => setF("goalId", e.target.value)} style={{ background: "#1E1E28", border: "1px solid #ffffff10", borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 14, width: "100%", marginBottom: 10, outline: "none", fontFamily: "'DM Sans',sans-serif" }}>
                  <option value="">Kein Ziel</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn>
              <Btn color="#00C896" style={{ flex: 2 }} onClick={addRoutine}>Anlegen</Btn>
            </div>
          </Modal>
        )}

        {/* Routine bearbeiten */}
        {modal === "editRoutine" && editingRoutine && (
          <Modal onClose={closeModal}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Routine bearbeiten</div>
            <Input placeholder="Name" value={form.title || ""} onChange={e => setF("title", e.target.value)} />
            <div style={{ fontSize: 11, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>Häufigkeit</div>
            <FreqToggle value={form.frequency || "daily"} onChange={v => setF("frequency", v)} />
            {goals.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8, marginTop: 4 }}>
                  Mit Ziel verknüpfen
                </div>
                <select value={form.goalId || ""} onChange={e => setF("goalId", e.target.value)} style={{ background: "#1E1E28", border: "1px solid #ffffff10", borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 14, width: "100%", marginBottom: 10, outline: "none", fontFamily: "'DM Sans',sans-serif" }}>
                  <option value="">Kein Ziel</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn>
              <Btn color={editingRoutine.color} style={{ flex: 2 }} onClick={updateRoutine}>Speichern</Btn>
            </div>
          </Modal>
        )}

        {/* Wochentitel setzen oder bearbeiten */}
        {modal === "editWeek" && (
          <Modal onClose={closeModal}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              KW {weekNumFromKey(currentWeekKey)}
            </div>
            <div style={{ fontSize: 12, color: "#ffffff30", fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>
              {currentWeekKey}
            </div>
            <Input
              placeholder="Titel dieser Woche (z.B. Woche der Disziplin)"
              value={form.weekTitle || ""}
              onChange={e => setF("weekTitle", e.target.value)}
            />
            <Input
              placeholder="Motto / Quote (optional)"
              value={form.weekMotto || ""}
              onChange={e => setF("weekMotto", e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn>
              <Btn color="#FF6B35" style={{ flex: 2 }} onClick={saveWeek}>Speichern</Btn>
            </div>
          </Modal>
        )}

      </div>
    </>
  );
}
