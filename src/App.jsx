// ─────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────
// SUPABASE VERBINDUNG
// createClient verbindet die App mit der Supabase-Datenbank.
// URL und Key identifizieren dein Projekt.
// Der publishable Key ist öffentlich – er darf im Code stehen.
// ─────────────────────────────────────────────
const supabase = createClient(
  "https://xamdhqshtbvfzeerryvo.supabase.co",
  "sb_publishable_UJ6RvvpyOQZhGzL73u60Fw_UfDp_iJa"
);

const COLORS = [
  { bg: "#FF6B35" }, { bg: "#00C896" }, { bg: "#4A90E2" },
  { bg: "#F5A623" }, { bg: "#BD10E0" }, { bg: "#E84393" },
];

const defaultData = {
  goals: [], nextGoalId: 1, nextTaskId: 1,
  routines: [], nextRoutineId: 1, weeks: {},
};


// ─────────────────────────────────────────────
// DATENSPEICHERUNG MIT SUPABASE (Custom Hook)
// Statt localStorage wird jetzt Supabase verwendet.
// Alle Daten werden als ein JSON-Blob in der Datenbank gespeichert.
// So können Handy und PC auf dieselben Daten zugreifen.
// ─────────────────────────────────────────────
function useData(userId) {
  const [data, setData] = useState(defaultData);
  const [loaded, setLoaded] = useState(false);

  // Daten laden wenn userId vorhanden (= User eingeloggt)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data: rows } = await supabase
        .from("data")
        .select("content")
        .eq("user_id", userId)
        .eq("id", "main")
        .single();

      if (rows?.content) {
        // Gespeicherte Daten mit defaultData zusammenführen
        // (sichert gegen fehlende Felder bei alten Datensätzen)
        setData({ ...defaultData, ...rows.content });
      }
      setLoaded(true);
    })();
  }, [userId]);

  // Speichert neuen Zustand in Supabase
  // upsert = insert ODER update (je nachdem ob Zeile schon existiert)
  const save = async (d) => {
    setData(d); // sofort UI updaten (optimistic update)
    await supabase.from("data").upsert({
      id: "main",
      user_id: userId,
      content: d,
      updated_at: new Date().toISOString(),
    });
  };

  return { data, save, loaded };
}


// ─────────────────────────────────────────────
// HILFSFUNKTIONEN
// ─────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split("T")[0];

const getWeekKey = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + 4 - day);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
};

const weekNumFromKey = (key) => parseInt(key.split("-W")[1]);

const thisWeekDays = () => {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
};

const isDoneToday = (logs) => (logs || []).includes(todayStr());

const calcStreak = (logs, frequency) => {
  if (!logs || logs.length === 0) return 0;
  const sorted = [...logs].sort((a, b) => new Date(b) - new Date(a));
  if (frequency === "daily") {
    const t = todayStr();
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (sorted[0] !== t && sorted[0] !== yesterday) return 0;
    let streak = 1, current = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const expected = new Date(new Date(current) - 86400000).toISOString().split("T")[0];
      if (sorted[i] === expected) { streak++; current = sorted[i]; } else break;
    }
    return streak;
  }
  return logs.length > 0 ? 1 : 0;
};

const getMonthDays = (year, month) => {
  const days = [];
  const n = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= n; d++)
    days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  return days;
};

const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();


// ─────────────────────────────────────────────
// UI-KOMPONENTEN
// ─────────────────────────────────────────────

const Modal = ({ onClose, children }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0A0A0Fcc", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#13131A", borderRadius: "20px 20px 0 0", padding: "28px 24px 44px", width: "100%", maxWidth: 430, border: "1px solid #ffffff0a" }}>{children}</div>
  </div>
);

const Input = ({ style = {}, ...props }) => (
  <input style={{ background: "#1E1E28", border: "1px solid #ffffff10", borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none", fontFamily: "'DM Sans',sans-serif", marginBottom: 10, ...style }} {...props} />
);

const Textarea = ({ style = {}, ...props }) => (
  <textarea style={{ background: "#1E1E28", border: "1px solid #ffffff10", borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none", fontFamily: "'DM Sans',sans-serif", marginBottom: 10, resize: "vertical", minHeight: 72, ...style }} {...props} />
);

const Btn = ({ color, children, style = {}, ...props }) => (
  <button style={{ background: color || "#ffffff", color: color ? "#ffffff" : "#0A0A0F", border: "none", borderRadius: 10, padding: "13px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: 0.3, ...style }} {...props}>{children}</button>
);

const FreqToggle = ({ value, onChange }) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
    {["daily", "weekly"].map(f => (
      <button key={f} onClick={() => onChange(f)} style={{ flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", background: value === f ? "#ffffff" : "#1E1E28", color: value === f ? "#0A0A0F" : "#ffffff40" }}>
        {f === "daily" ? "Täglich" : "Wöchentlich"}
      </button>
    ))}
  </div>
);


// ─────────────────────────────────────────────
// LOGIN-BILDSCHIRM
// Einfaches Email/Passwort Login mit Supabase Auth.
// Nach dem Login gibt Supabase eine User-ID zurück
// die dann zum Laden der richtigen Daten verwendet wird.
// ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false); // false = Login, true = Registrieren
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      let result;
      if (isSignUp) {
        // Neuen Account erstellen
        result = await supabase.auth.signUp({ email, password });
      } else {
        // Bestehenden Account einloggen
        result = await supabase.auth.signInWithPassword({ email, password });
      }
      if (result.error) {
        setError(result.error.message);
      } else if (result.data?.user) {
        onLogin(result.data.user);
      }
    } catch (e) {
      setError("Ein Fehler ist aufgetreten.");
    }
    setLoading(false);
  };

  return (
    <div style={{ background: "#0A0A0F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* App-Titel */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#ffffff30", textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>Goals App</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ffffff" }}>
            {isSignUp ? "Account erstellen" : "Willkommen zurück"}
          </div>
        </div>

        {/* Formular */}
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
        />

        {/* Fehlermeldung */}
        {error && (
          <div style={{ color: "#FF6B35", fontSize: 12, marginBottom: 10, padding: "8px 12px", background: "#FF6B3510", borderRadius: 8 }}>
            {error}
          </div>
        )}

        <Btn color="#FF6B35" style={{ width: "100%", opacity: loading ? 0.6 : 1 }} onClick={handleSubmit}>
          {loading ? "..." : isSignUp ? "Registrieren" : "Einloggen"}
        </Btn>

        {/* Zwischen Login und Registrieren wechseln */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            style={{ background: "none", border: "none", color: "#ffffff40", cursor: "pointer", fontSize: 13 }}>
            {isSignUp ? "Bereits registriert? Einloggen" : "Noch kein Account? Registrieren"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// HAUPTKOMPONENTE
// ─────────────────────────────────────────────
export default function App() {
  // user = eingeloggter Supabase-User (null = nicht eingeloggt)
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false); // verhindert Flackern beim Start

  // Beim App-Start prüfen ob User noch eingeloggt ist (Session aus Browser)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user);
      setAuthChecked(true);
    });

    // Lauscht auf Login/Logout-Events
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Ladebildschirm während Auth-Status geprüft wird
  if (!authChecked) return (
    <div style={{ background: "#0A0A0F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#ffffff30", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 4 }}>LOADING</div>
    </div>
  );

  // Nicht eingeloggt → Login-Bildschirm zeigen
  if (!user) return <LoginScreen onLogin={setUser} />;

  // Eingeloggt → Haupt-App zeigen
  return <MainApp user={user} />;
}


// ─────────────────────────────────────────────
// HAUPT-APP (nur wenn eingeloggt)
// Wird als separate Komponente ausgelagert damit
// useData() erst aufgerufen wird wenn user vorhanden ist.
// ─────────────────────────────────────────────
function MainApp({ user }) {
  const { data, save, loaded } = useData(user.id);

  const [view, setView] = useState("dashboard");
  const [activeGoalId, setActiveGoalId] = useState(null);
  const [activeRoutineId, setActiveRoutineId] = useState(null);
  const [modal, setModal] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [form, setForm] = useState({});
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const closeModal = () => { setModal(null); setForm({}); setEditingGoal(null); setEditingTask(null); setEditingRoutine(null); };

  // Ladebildschirm während Daten aus Supabase geladen werden
  if (!loaded) return (
    <div style={{ background: "#0A0A0F", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#ffffff30", fontFamily: "'DM Mono',monospace", fontSize: 13, letterSpacing: 4 }}>DATEN LADEN</div>
    </div>
  );

  const goals = data.goals || [];
  const routines = data.routines || [];
  const weeks = data.weeks || {};
  const currentWeekKey = getWeekKey();
  const currentWeek = weeks[currentWeekKey] || null;
  const totalTasks = goals.reduce((a, g) => a + (g.tasks?.length || 0), 0);
  const doneTasks = goals.reduce((a, g) => a + (g.tasks?.filter(t => t.done)?.length || 0), 0);
  const progress = g => g.tasks?.length > 0 ? Math.round((g.tasks.filter(t => t.done).length / g.tasks.length) * 100) : 0;
  const weekDays = thisWeekDays();
  const upcomingTasks = goals.flatMap(g => (g.tasks || []).filter(t => !t.done && t.due).map(t => ({ ...t, goalTitle: g.title, goalColor: g.color }))).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
  const bestStreak = routines.length > 0 ? Math.max(...routines.map(r => calcStreak(r.logs, r.frequency))) : 0;

  // ─── AKTIONEN ───
  const addGoal = () => {
    if (!form.title?.trim()) return;
    const color = COLORS[goals.length % COLORS.length];
    save({ ...data, goals: [...goals, { id: data.nextGoalId, title: form.title.trim(), desc: form.desc?.trim() || "", deadline: form.deadline || "", color: color.bg, tasks: [], createdAt: new Date().toISOString() }], nextGoalId: data.nextGoalId + 1 });
    closeModal();
  };
  const updateGoal = () => {
    if (!form.title?.trim()) return;
    save({ ...data, goals: goals.map(g => g.id === editingGoal.id ? { ...g, title: form.title.trim(), desc: form.desc?.trim() || "", deadline: form.deadline || "" } : g) });
    closeModal();
  };
  const deleteGoal = (id) => { save({ ...data, goals: goals.filter(g => g.id !== id) }); setView("dashboard"); setActiveGoalId(null); };
  const addTask = (goalId) => {
    if (!form.title?.trim()) return;
    save({ ...data, goals: goals.map(g => g.id === goalId ? { ...g, tasks: [...(g.tasks || []), { id: data.nextTaskId, title: form.title.trim(), notes: form.notes?.trim() || "", due: form.due || "", done: false, createdAt: new Date().toISOString() }] } : g), nextTaskId: data.nextTaskId + 1 });
    closeModal();
  };
  const updateTask = (goalId) => {
    if (!form.title?.trim()) return;
    save({ ...data, goals: goals.map(g => g.id === goalId ? { ...g, tasks: g.tasks.map(t => t.id === editingTask.id ? { ...t, title: form.title.trim(), notes: form.notes?.trim() || "", due: form.due || "" } : t) } : g) });
    closeModal();
  };
  const toggleTask = (goalId, taskId) => {
    save({ ...data, goals: goals.map(g => g.id === goalId ? { ...g, tasks: g.tasks.map(t => t.id === taskId ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : null } : t) } : g) });
  };
  const deleteTask = (goalId, taskId) => { save({ ...data, goals: goals.map(g => g.id === goalId ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) } : g) }); };
  const moveTask = (goalId, taskId, dir) => {
    const g = goals.find(g => g.id === goalId);
    const idx = g.tasks.findIndex(t => t.id === taskId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= g.tasks.length) return;
    const tasks = [...g.tasks];
    [tasks[idx], tasks[newIdx]] = [tasks[newIdx], tasks[idx]];
    save({ ...data, goals: goals.map(g => g.id === goalId ? { ...g, tasks } : g) });
  };
  const addRoutine = () => {
    if (!form.title?.trim()) return;
    const color = COLORS[routines.length % COLORS.length];
    save({ ...data, routines: [...routines, { id: data.nextRoutineId, title: form.title.trim(), frequency: form.frequency || "daily", goalId: form.goalId ? Number(form.goalId) : null, color: color.bg, logs: [], createdAt: new Date().toISOString() }], nextRoutineId: data.nextRoutineId + 1 });
    closeModal();
  };
  const updateRoutine = () => {
    if (!form.title?.trim()) return;
    save({ ...data, routines: routines.map(r => r.id === editingRoutine.id ? { ...r, title: form.title.trim(), frequency: form.frequency || r.frequency, goalId: form.goalId ? Number(form.goalId) : null } : r) });
    closeModal();
  };
  const deleteRoutine = (id) => { save({ ...data, routines: routines.filter(r => r.id !== id) }); setView("routines"); setActiveRoutineId(null); };
  const toggleRoutineToday = (routineId) => {
    const t = todayStr();
    save({ ...data, routines: routines.map(r => r.id === routineId ? { ...r, logs: r.logs.includes(t) ? r.logs.filter(d => d !== t) : [...r.logs, t] } : r) });
  };
  const saveWeek = () => {
    if (!form.weekTitle?.trim()) return;
    save({ ...data, weeks: { ...weeks, [currentWeekKey]: { title: form.weekTitle.trim(), motto: form.weekMotto?.trim() || "", createdAt: new Date().toISOString() } } });
    closeModal();
  };

  // Ausloggen
  const logout = async () => { await supabase.auth.signOut(); };

  const activeGoal = goals.find(g => g.id === activeGoalId);
  const activeRoutine = routines.find(r => r.id === activeRoutineId);

  // ─── STYLES ───
  const s = {
    app: { background: "#0A0A0F", minHeight: "100vh", fontFamily: "'DM Sans',sans-serif", color: "#E8E8F0", maxWidth: 430, margin: "0 auto", paddingBottom: 80 },
    header: { padding: "48px 24px 24px", borderBottom: "1px solid #ffffff0a" },
    label: { fontSize: 11, letterSpacing: 4, color: "#ffffff30", textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8 },
    h1: { fontSize: 28, fontWeight: 700, color: "#ffffff", letterSpacing: -0.5, lineHeight: 1.1 },
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#0A0A0F", borderTop: "1px solid #ffffff0a", display: "flex", zIndex: 100, padding: "12px 0 20px" },
    navBtn: (a) => ({ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: a ? "#ffffff" : "#ffffff25", fontSize: 10, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }),
    card: (color) => ({ background: "#13131A", border: `1px solid ${color}25`, borderRadius: 16, padding: "20px", marginBottom: 12 }),
    pill: (color) => ({ display: "inline-block", background: `${color}20`, color: color, fontSize: 10, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", padding: "4px 10px", borderRadius: 20 }),
    progressBar: { height: 6, background: "#ffffff08", borderRadius: 4, marginTop: 12, overflow: "hidden" },
    progressFill: (pct, color) => ({ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.5s ease" }),
    bigProgress: (pct, color) => ({ width: 80, height: 80, borderRadius: "50%", background: `conic-gradient(${color} ${pct * 3.6}deg, #1E1E28 0deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }),
    bigProgressInner: { width: 60, height: 60, borderRadius: "50%", background: "#13131A", display: "flex", alignItems: "center", justifyContent: "center" },
    block: { background: "#13131A", borderRadius: 14, padding: "16px", marginBottom: 16 },
  };

  // ─── DASHBOARD ───
  const Dashboard = () => {
    const weekNum = weekNumFromKey(currentWeekKey);
    return (
      <div>
        {/* Wochen-Hero */}
        <div style={{ padding: "40px 24px 24px", borderBottom: "1px solid #ffffff0a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={s.label}>KW {weekNum}</div>
              {currentWeek ? (
                <>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", lineHeight: 1.2, marginBottom: 6 }}>{currentWeek.title}</div>
                  {currentWeek.motto && <div style={{ fontSize: 13, color: "#ffffff40", fontStyle: "italic", lineHeight: 1.5 }}>„{currentWeek.motto}"</div>}
                </>
              ) : (
                <div onClick={() => { setForm({ weekTitle: "", weekMotto: "" }); setModal("editWeek"); }}
                  style={{ cursor: "pointer", background: "#FF6B3510", border: "1px dashed #FF6B3540", borderRadius: 10, padding: "12px 14px", marginTop: 4 }}>
                  <div style={{ fontSize: 13, color: "#FF6B35", fontWeight: 600 }}>Woche noch ohne Titel</div>
                  <div style={{ fontSize: 11, color: "#FF6B3580", marginTop: 2 }}>Tippen um Titel + Motto zu setzen →</div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {currentWeek && (
                <button onClick={() => { setForm({ weekTitle: currentWeek.title, weekMotto: currentWeek.motto || "" }); setModal("editWeek"); }}
                  style={{ background: "none", border: "none", color: "#ffffff20", cursor: "pointer", fontSize: 18, padding: 4 }}>✎</button>
              )}
              {/* Logout-Button */}
              <button onClick={logout}
                style={{ background: "none", border: "none", color: "#ffffff15", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", padding: 4 }}>
                Out
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px 0" }}>
          {/* Stats */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {[["#FF6B35", goals.length, "Ziele"], ["#00C896", doneTasks, "Erledigt"], ["#F5A623", bestStreak, "Best Streak"]].map(([c, n, l]) => (
              <div key={l} style={{ background: "#13131A", border: "1px solid #ffffff08", borderRadius: 12, padding: 16, flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: -1, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 9, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Wochenfortschritt */}
          {totalTasks > 0 && (
            <div style={s.block}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={s.label}>Diese Woche</div>
                <div style={{ fontSize: 12, color: "#ffffff40", fontFamily: "'DM Mono',monospace" }}>{doneTasks}/{totalTasks}</div>
              </div>
              <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
                {weekDays.map((day, i) => {
                  const doneOnDay = goals.reduce((a, g) => a + (g.tasks || []).filter(t => t.doneAt?.startsWith(day)).length, 0);
                  const isToday = day === todayStr();
                  const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
                  return (
                    <div key={day} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ height: 32, borderRadius: 4, background: doneOnDay > 0 ? "#00C896" : isToday ? "#ffffff10" : "#ffffff05", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: doneOnDay > 0 ? "#ffffff" : "#ffffff20", fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>
                        {doneOnDay > 0 ? doneOnDay : ""}
                      </div>
                      <div style={{ fontSize: 9, color: isToday ? "#ffffff60" : "#ffffff20", fontFamily: "'DM Mono',monospace" }}>{dayNames[i]}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ height: 4, background: "#ffffff08", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%`, background: "#00C896", borderRadius: 4, transition: "width 0.5s" }} />
              </div>
            </div>
          )}

          {/* Zielfortschritt */}
          {goals.length > 0 && (
            <div style={s.block}>
              <div style={{ ...s.label, marginBottom: 14 }}>Zielfortschritt</div>
              {goals.map(g => {
                const pct = progress(g);
                return (
                  <div key={g.id} style={{ marginBottom: 14, cursor: "pointer" }} onClick={() => { setActiveGoalId(g.id); setView("goal"); }}>
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
              <Btn color="#FF6B35" style={{ width: "100%", marginTop: 4 }} onClick={() => { setForm({}); setModal("addGoal"); }}>+ Neues Ziel</Btn>
            </div>
          )}

          {goals.length === 0 && <Btn color="#FF6B35" style={{ width: "100%", marginBottom: 16 }} onClick={() => { setForm({}); setModal("addGoal"); }}>+ Erstes Ziel anlegen</Btn>}

          {/* Routinen heute */}
          {routines.filter(r => r.frequency === "daily").length > 0 && (
            <div style={s.block}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={s.label}>Routinen heute</div>
                <div style={{ fontSize: 11, color: "#ffffff25", fontFamily: "'DM Mono',monospace" }}>
                  {routines.filter(r => r.frequency === "daily" && isDoneToday(r.logs)).length}/{routines.filter(r => r.frequency === "daily").length}
                </div>
              </div>
              {routines.filter(r => r.frequency === "daily").map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #ffffff06" }}>
                  <div onClick={() => toggleRoutineToday(r.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: `2px solid ${isDoneToday(r.logs) ? r.color : "#ffffff15"}`, background: isDoneToday(r.logs) ? r.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    {isDoneToday(r.logs) && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
                  </div>
                  <div style={{ flex: 1, fontSize: 13 }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: calcStreak(r.logs, r.frequency) > 0 ? r.color : "#ffffff15", fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>🔥 {calcStreak(r.logs, r.frequency)}</div>
                </div>
              ))}
              <button onClick={() => setView("routines")} style={{ background: "none", border: "none", color: "#ffffff20", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase", cursor: "pointer", marginTop: 10, padding: 0 }}>Alle Routinen →</button>
            </div>
          )}

          {/* Upcoming */}
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

          {/* Wochenarchiv */}
          {Object.keys(weeks).filter(k => k !== currentWeekKey).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ ...s.label, marginBottom: 12 }}>Wochenarchiv</div>
              {Object.entries(weeks).filter(([key]) => key !== currentWeekKey).sort(([a], [b]) => b.localeCompare(a)).slice(0, 5).map(([key, w]) => (
                <div key={key} style={{ padding: "10px 0", borderBottom: "1px solid #ffffff06" }}>
                  <div style={{ fontSize: 10, color: "#ffffff20", fontFamily: "'DM Mono',monospace", letterSpacing: 3, marginBottom: 2 }}>KW {weekNumFromKey(key)}</div>
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

  // ─── ZIEL-DETAIL ───
  const GoalView = () => {
    const [expandedTask, setExpandedTask] = useState(null);
    if (!activeGoal) return null;
    const pct = progress(activeGoal);
    const tasks = activeGoal.tasks || [];
    const linkedRoutines = routines.filter(r => r.goalId === activeGoal.id);
    return (
      <div>
        <div style={{ ...s.header, borderLeft: `3px solid ${activeGoal.color}` }}>
          <button onClick={() => { setView("dashboard"); setActiveGoalId(null); }} style={{ background: "none", border: "none", color: "#ffffff40", cursor: "pointer", fontSize: 12, letterSpacing: 3, fontFamily: "'DM Mono',monospace", padding: 0, marginBottom: 16, textTransform: "uppercase" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={s.label}>Goal</div>
              <div style={s.h1}>{activeGoal.title}</div>
              {activeGoal.desc && <div style={{ fontSize: 13, color: "#ffffff40", marginTop: 6 }}>{activeGoal.desc}</div>}
              {activeGoal.deadline && <div style={{ fontSize: 11, color: "#ffffff25", fontFamily: "'DM Mono',monospace", marginTop: 8 }}>Due {new Date(activeGoal.deadline).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })}</div>}
            </div>
            <div style={s.bigProgress(pct, activeGoal.color)}><div style={s.bigProgressInner}><span style={{ fontSize: 13, fontWeight: 700, color: activeGoal.color }}>{pct}%</span></div></div>
          </div>
          <div style={{ ...s.progressBar, marginTop: 16 }}><div style={s.progressFill(pct, activeGoal.color)} /></div>
        </div>
        <div style={{ padding: "20px 24px" }}>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={s.label}>Tasks ({tasks.filter(t => t.done).length}/{tasks.length})</div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { setForm({ title: activeGoal.title, desc: activeGoal.desc, deadline: activeGoal.deadline }); setEditingGoal(activeGoal); setModal("editGoal"); }} style={{ background: "none", border: "none", color: "#ffffff40", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>Edit</button>
              <button onClick={() => deleteGoal(activeGoal.id)} style={{ background: "none", border: "none", color: "#ff444440", cursor: "pointer", fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>Delete</button>
            </div>
          </div>
          {tasks.length === 0 && <div style={{ color: "#ffffff20", fontSize: 13, padding: "20px 0" }}>Noch keine Tasks.</div>}
          {tasks.map((t, i) => (
            <div key={t.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #ffffff06", opacity: t.done ? 0.45 : 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => moveTask(activeGoal.id, t.id, -1)} disabled={i === 0} style={{ background: "none", border: "none", color: i === 0 ? "#ffffff08" : "#ffffff25", cursor: i === 0 ? "default" : "pointer", padding: "2px 4px", fontSize: 10, lineHeight: 1 }}>▲</button>
                  <button onClick={() => moveTask(activeGoal.id, t.id, 1)} disabled={i === tasks.length - 1} style={{ background: "none", border: "none", color: i === tasks.length - 1 ? "#ffffff08" : "#ffffff25", cursor: i === tasks.length - 1 ? "default" : "pointer", padding: "2px 4px", fontSize: 10, lineHeight: 1 }}>▼</button>
                </div>
                <div onClick={() => toggleTask(activeGoal.id, t.id)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${t.done ? activeGoal.color : "#ffffff15"}`, background: t.done ? activeGoal.color : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {t.done && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
                </div>
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedTask(expandedTask === t.id ? null : t.id)}>
                  <div style={{ fontSize: 14, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    {t.due && <span style={{ fontSize: 11, color: "#ffffff30", fontFamily: "'DM Mono',monospace" }}>{new Date(t.due).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}</span>}
                    {t.notes && <span style={{ fontSize: 11, color: "#ffffff25" }}>📝</span>}
                  </div>
                </div>
                <button onClick={() => { setForm({ title: t.title, notes: t.notes || "", due: t.due || "" }); setEditingTask(t); setModal("editTask"); }} style={{ background: "none", border: "none", color: "#ffffff25", cursor: "pointer", fontSize: 13, padding: 4 }}>✎</button>
                <button onClick={() => deleteTask(activeGoal.id, t.id)} style={{ background: "none", border: "none", color: "#ffffff15", cursor: "pointer", fontSize: 16, padding: 4 }}>×</button>
              </div>
              {expandedTask === t.id && t.notes && (
                <div style={{ background: "#1E1E28", borderRadius: 8, padding: "10px 14px", marginBottom: 8, fontSize: 13, color: "#ffffff60", lineHeight: 1.6 }}>{t.notes}</div>
              )}
            </div>
          ))}
          <Btn color={activeGoal.color} style={{ width: "100%", marginTop: 16 }} onClick={() => { setForm({}); setModal("addTask"); }}>+ Add Task</Btn>
        </div>
      </div>
    );
  };

  // ─── ROUTINEN ÜBERSICHT ───
  const RoutinesView = () => (
    <div>
      <div style={s.header}>
        <div style={s.label}>Gewohnheiten</div>
        <div style={s.h1}>Routinen</div>
        {routines.filter(r => r.frequency === "daily").length > 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: "#ffffff40" }}>
            Heute: {routines.filter(r => r.frequency === "daily" && isDoneToday(r.logs)).length}/{routines.filter(r => r.frequency === "daily").length} erledigt
          </div>
        )}
      </div>
      <div style={{ padding: "20px 24px 0" }}>
        {routines.filter(r => r.frequency === "daily").length > 0 && (<><div style={{ ...s.label, marginBottom: 12 }}>Täglich</div>{routines.filter(r => r.frequency === "daily").map(r => <RoutineCard key={r.id} routine={r} />)}</>)}
        {routines.filter(r => r.frequency === "weekly").length > 0 && (<><div style={{ ...s.label, marginBottom: 12, marginTop: 8 }}>Wöchentlich</div>{routines.filter(r => r.frequency === "weekly").map(r => <RoutineCard key={r.id} routine={r} />)}</>)}
        {routines.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "#ffffff20", fontSize: 13 }}>Noch keine Routinen.</div>}
        <Btn color="#00C896" style={{ width: "100%", marginTop: 8 }} onClick={() => { setForm({ frequency: "daily" }); setModal("addRoutine"); }}>+ Neue Routine</Btn>
      </div>
    </div>
  );

  const RoutineCard = ({ routine: r }) => {
    const streak = calcStreak(r.logs, r.frequency);
    const done = isDoneToday(r.logs);
    const linkedGoal = goals.find(g => g.id === r.goalId);
    const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split("T")[0]; });
    return (
      <div style={{ ...s.card(r.color), cursor: "pointer" }} onClick={() => { setActiveRoutineId(r.id); setView("routineDetail"); }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div onClick={e => { e.stopPropagation(); toggleRoutineToday(r.id); }} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, cursor: "pointer", border: `2px solid ${done ? r.color : "#ffffff15"}`, background: done ? r.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
            {done ? <svg width="14" height="11" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg> : <div style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, opacity: 0.4 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#ffffff", marginBottom: 2 }}>{r.title}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={s.pill(r.color)}>{r.frequency === "daily" ? "täglich" : "wöchentlich"}</span>
              {linkedGoal && <span style={{ fontSize: 11, color: "#ffffff30" }}>→ {linkedGoal.title}</span>}
            </div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: streak > 0 ? r.color : "#ffffff15", lineHeight: 1 }}>{streak}</div>
            <div style={{ fontSize: 9, color: "#ffffff25", fontFamily: "'DM Mono',monospace", letterSpacing: 2 }}>STREAK</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
          {last7.map(day => <div key={day} style={{ flex: 1, height: 6, borderRadius: 3, background: r.logs.includes(day) ? r.color : "#ffffff08" }} />)}
        </div>
      </div>
    );
  };

  // ─── ROUTINE DETAIL ───
  const RoutineDetailView = () => {
    if (!activeRoutine) return null;
    const streak = calcStreak(activeRoutine.logs, activeRoutine.frequency);
    const linkedGoal = goals.find(g => g.id === activeRoutine.goalId);
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const monthDays = getMonthDays(year, month);
    const firstDay = (firstDayOfMonth(year, month) + 6) % 7;
    const monthName = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const totalDone = activeRoutine.logs.length;
    const thisMonthDone = activeRoutine.logs.filter(d => d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length;
    return (
      <div>
        <div style={{ ...s.header, borderLeft: `3px solid ${activeRoutine.color}` }}>
          <button onClick={() => { setView("routines"); setActiveRoutineId(null); }} style={{ background: "none", border: "none", color: "#ffffff40", cursor: "pointer", fontSize: 12, letterSpacing: 3, fontFamily: "'DM Mono',monospace", padding: 0, marginBottom: 16, textTransform: "uppercase" }}>← Back</button>
          <div style={s.label}>Routine</div>
          <div style={s.h1}>{activeRoutine.title}</div>
          {linkedGoal && <div style={{ fontSize: 13, color: "#ffffff40", marginTop: 6 }}>→ {linkedGoal.title}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {[[activeRoutine.color, streak, "Streak"], ["#4A90E2", thisMonthDone, "Diesen Monat"], ["#00C896", totalDone, "Gesamt"]].map(([c, n, l]) => (
              <div key={l} style={{ background: "#1E1E28", borderRadius: 10, padding: "12px 8px", flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 9, color: "#ffffff25", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <Btn color={isDoneToday(activeRoutine.logs) ? "#ffffff15" : activeRoutine.color} style={{ width: "100%", marginBottom: 24 }} onClick={() => toggleRoutineToday(activeRoutine.id)}>
            {isDoneToday(activeRoutine.logs) ? "✓ Heute erledigt" : "Heute abhaken"}
          </Btn>
          <div style={{ ...s.label, marginBottom: 12 }}>{monthName}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 24 }}>
            {weekdays.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#ffffff20", fontFamily: "'DM Mono',monospace", paddingBottom: 4 }}>{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {monthDays.map(day => {
              const isToday = day === todayStr();
              const isDone = activeRoutine.logs.includes(day);
              return (
                <div key={day} onClick={() => { if (day <= todayStr()) save({ ...data, routines: routines.map(r => r.id === activeRoutine.id ? { ...r, logs: r.logs.includes(day) ? r.logs.filter(d => d !== day) : [...r.logs, day] } : r) }); }}
                  style={{ aspectRatio: "1", borderRadius: 6, cursor: "pointer", background: isDone ? activeRoutine.color : isToday ? "#ffffff10" : "transparent", border: isToday ? `1px solid ${activeRoutine.color}` : "1px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "'DM Mono',monospace", color: isDone ? "#ffffff" : isToday ? "#ffffff" : "#ffffff30" }}>
                  {parseInt(day.split("-")[2])}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setForm({ title: activeRoutine.title, frequency: activeRoutine.frequency, goalId: activeRoutine.goalId || "" }); setEditingRoutine(activeRoutine); setModal("editRoutine"); }} style={{ flex: 1, background: "#1E1E28", border: "none", borderRadius: 10, padding: "12px", color: "#ffffff60", fontSize: 13, cursor: "pointer" }}>Bearbeiten</button>
            <button onClick={() => deleteRoutine(activeRoutine.id)} style={{ flex: 1, background: "#1E1E28", border: "none", borderRadius: 10, padding: "12px", color: "#ff444460", fontSize: 13, cursor: "pointer" }}>Löschen</button>
          </div>
        </div>
      </div>
    );
  };

  // ─── RENDER ───
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={s.app}>
        {view === "dashboard" && <Dashboard />}
        {view === "goal" && <GoalView />}
        {view === "routines" && <RoutinesView />}
        {view === "routineDetail" && <RoutineDetailView />}

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

        {/* MODALS */}
        {modal === "addGoal" && (<Modal onClose={closeModal}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Neues Ziel</div><Input placeholder="Titel" value={form.title || ""} onChange={e => setF("title", e.target.value)} /><Input placeholder="Beschreibung (optional)" value={form.desc || ""} onChange={e => setF("desc", e.target.value)} /><Input type="date" value={form.deadline || ""} onChange={e => setF("deadline", e.target.value)} /><div style={{ display: "flex", gap: 10, marginTop: 4 }}><Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn><Btn color="#FF6B35" style={{ flex: 2 }} onClick={addGoal}>Anlegen</Btn></div></Modal>)}
        {modal === "editGoal" && editingGoal && (<Modal onClose={closeModal}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Ziel bearbeiten</div><Input placeholder="Titel" value={form.title || ""} onChange={e => setF("title", e.target.value)} /><Input placeholder="Beschreibung" value={form.desc || ""} onChange={e => setF("desc", e.target.value)} /><Input type="date" value={form.deadline || ""} onChange={e => setF("deadline", e.target.value)} /><div style={{ display: "flex", gap: 10, marginTop: 4 }}><Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn><Btn color={editingGoal.color} style={{ flex: 2 }} onClick={updateGoal}>Speichern</Btn></div></Modal>)}
        {modal === "addTask" && activeGoal && (<Modal onClose={closeModal}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Neuer Task</div><Input placeholder="Titel" value={form.title || ""} onChange={e => setF("title", e.target.value)} /><Textarea placeholder="Notizen (optional)" value={form.notes || ""} onChange={e => setF("notes", e.target.value)} /><Input type="date" value={form.due || ""} onChange={e => setF("due", e.target.value)} /><div style={{ display: "flex", gap: 10, marginTop: 4 }}><Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn><Btn color={activeGoal.color} style={{ flex: 2 }} onClick={() => addTask(activeGoal.id)}>Hinzufügen</Btn></div></Modal>)}
        {modal === "editTask" && editingTask && activeGoal && (<Modal onClose={closeModal}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Task bearbeiten</div><Input placeholder="Titel" value={form.title || ""} onChange={e => setF("title", e.target.value)} /><Textarea placeholder="Notizen" value={form.notes || ""} onChange={e => setF("notes", e.target.value)} /><Input type="date" value={form.due || ""} onChange={e => setF("due", e.target.value)} /><div style={{ display: "flex", gap: 10, marginTop: 4 }}><Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn><Btn color={activeGoal.color} style={{ flex: 2 }} onClick={() => updateTask(activeGoal.id)}>Speichern</Btn></div></Modal>)}
        {modal === "addRoutine" && (<Modal onClose={closeModal}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Neue Routine</div><Input placeholder="Name" value={form.title || ""} onChange={e => setF("title", e.target.value)} /><div style={{ fontSize: 11, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>Häufigkeit</div><FreqToggle value={form.frequency || "daily"} onChange={v => setF("frequency", v)} />{goals.length > 0 && <><div style={{ fontSize: 11, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8, marginTop: 4 }}>Mit Ziel verknüpfen</div><select value={form.goalId || ""} onChange={e => setF("goalId", e.target.value)} style={{ background: "#1E1E28", border: "1px solid #ffffff10", borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 14, width: "100%", marginBottom: 10, outline: "none", fontFamily: "'DM Sans',sans-serif" }}><option value="">Kein Ziel</option>{goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></>}<div style={{ display: "flex", gap: 10, marginTop: 4 }}><Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn><Btn color="#00C896" style={{ flex: 2 }} onClick={addRoutine}>Anlegen</Btn></div></Modal>)}
        {modal === "editRoutine" && editingRoutine && (<Modal onClose={closeModal}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Routine bearbeiten</div><Input placeholder="Name" value={form.title || ""} onChange={e => setF("title", e.target.value)} /><div style={{ fontSize: 11, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>Häufigkeit</div><FreqToggle value={form.frequency || "daily"} onChange={v => setF("frequency", v)} />{goals.length > 0 && <><div style={{ fontSize: 11, color: "#ffffff30", letterSpacing: 3, textTransform: "uppercase", fontFamily: "'DM Mono',monospace", marginBottom: 8, marginTop: 4 }}>Mit Ziel verknüpfen</div><select value={form.goalId || ""} onChange={e => setF("goalId", e.target.value)} style={{ background: "#1E1E28", border: "1px solid #ffffff10", borderRadius: 10, padding: "12px 14px", color: "#E8E8F0", fontSize: 14, width: "100%", marginBottom: 10, outline: "none", fontFamily: "'DM Sans',sans-serif" }}><option value="">Kein Ziel</option>{goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></>}<div style={{ display: "flex", gap: 10, marginTop: 4 }}><Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn><Btn color={editingRoutine.color} style={{ flex: 2 }} onClick={updateRoutine}>Speichern</Btn></div></Modal>)}
        {modal === "editWeek" && (<Modal onClose={closeModal}><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>KW {weekNumFromKey(currentWeekKey)}</div><div style={{ fontSize: 12, color: "#ffffff30", fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>{currentWeekKey}</div><Input placeholder="Titel dieser Woche" value={form.weekTitle || ""} onChange={e => setF("weekTitle", e.target.value)} /><Input placeholder="Motto / Quote (optional)" value={form.weekMotto || ""} onChange={e => setF("weekMotto", e.target.value)} /><div style={{ display: "flex", gap: 10, marginTop: 4 }}><Btn style={{ flex: 1 }} onClick={closeModal}>Abbrechen</Btn><Btn color="#FF6B35" style={{ flex: 2 }} onClick={saveWeek}>Speichern</Btn></div></Modal>)}
      </div>
    </>
  );
}
