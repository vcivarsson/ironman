import { useState, useMemo } from "react";
import cachedWorkouts from "./workouts-cache.json";

const RACE_DATE = new Date("2026-11-22");

const DISCIPLINES = {
  swim: { label: "SWIM", color: "#38bdf8", bg: "#0c1a2e" },
  bike: { label: "BIKE", color: "#a3e635", bg: "#0f1e07" },
  run:  { label: "RUN",  color: "#fb923c", bg: "#1f0e04" },
  brick:{ label: "BRICK",color: "#c084fc", bg: "#160b21" },
  rest: { label: "REST", color: "#475569", bg: "#0f172a" },
};


// ─── Date helpers ─────────────────────────────────────────────────────────────

function getToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function getDaysUntilRace() {
  return Math.ceil((RACE_DATE - getToday()) / (1000 * 60 * 60 * 24));
}

function getWeekStart(offset) {
  const today = getToday();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7) + offset * 7);
  return monday;
}

function getWeekDays(weekOffset) {
  const monday = getWeekStart(weekOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().split("T")[0];
    return { date: d, key };
  });
}

function getOverallProgress(workouts) {
  const all = Object.values(workouts).filter(w => w.type !== "rest");
  const today = getToday();
  const past = Object.entries(workouts).filter(([k, w]) => w.type !== "rest" && new Date(k) < today);
  const completed = past.filter(([, w]) => w.completed).length;
  return { completed, total: all.length, past: past.length, pct: all.length ? Math.round((completed / all.length) * 100) : 0 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IronmanTracker() {
  const [completions, setCompletions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ironman-completions") || "{}"); }
    catch { return {}; }
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);

  const workouts = useMemo(() => {
    const merged = {};
    for (const [key, w] of Object.entries(cachedWorkouts)) {
      merged[key] = {
        ...w,
        completed: completions[key] !== undefined ? completions[key] : w.completed,
      };
    }
    return merged;
  }, [completions]);

  function toggleCompletion(dateKey) {
    setCompletions(prev => {
      const current = prev[dateKey] !== undefined ? prev[dateKey] : (cachedWorkouts[dateKey]?.completed ?? false);
      const next = { ...prev, [dateKey]: !current };
      localStorage.setItem("ironman-completions", JSON.stringify(next));
      return next;
    });
  }

  const today = getToday();
  const todayKey = today.toISOString().split("T")[0];
  const daysLeft = getDaysUntilRace();
  const progress = getOverallProgress(workouts);
  const weekDays = getWeekDays(weekOffset);
  const weekDaysWithWorkouts = weekDays.map(d => ({ ...d, workout: workouts[d.key] }));

  const weeklyStats = { swim: 0, bike: 0, run: 0, brick: 0 };
  weekDaysWithWorkouts.forEach(({ workout: w }) => {
    if (w && w.type !== "rest" && weeklyStats[w.type] !== undefined) weeklyStats[w.type]++;
  });

  const weekMonday = weekDays[0].date;
  const weekSunday = weekDays[6].date;
  const weekLabel = `${weekMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} → ${weekSunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const dayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  return (
    <div style={{ minHeight: "100vh", background: "#080c14", color: "#e2e8f0", fontFamily: "'DM Mono', 'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .day-card { cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; border: 1px solid #1e293b; }
        .day-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.5); border-color: #334155; }
        .day-card.today { border-color: #f59e0b !important; box-shadow: 0 0 0 1px #f59e0b40; }
        .day-card.selected { border-color: #60a5fa !important; box-shadow: 0 0 0 1px #60a5fa40; }
        .phase-bar { position: relative; height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden; }
        .phase-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
        .nav-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 6px 14px; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.1em; transition: all 0.15s; }
        .nav-btn:hover { background: #334155; color: #e2e8f0; }
        .ticker-number { font-family: 'Bebas Neue', sans-serif; line-height: 1; }
        .discipline-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; }
        .completed-check { animation: popIn 0.3s ease; }
        .completed-check:hover { opacity: 1 !important; transform: scale(1.15); }
        @keyframes popIn { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(180deg, #0d1117 0%, #080c14 100%)", borderBottom: "1px solid #1e293b", padding: "32px 40px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#475569", marginBottom: 8 }}>IRONMAN TRAINING TRACKER</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: "0.04em", lineHeight: 1, color: "#f1f5f9" }}>ROAD TO IRON</div>
              <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#64748b", marginTop: 6 }}>
                {RACE_DATE.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()} · FULL IRONMAN
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#475569", marginBottom: 4 }}>DAYS UNTIL RACE</div>
              <div className="ticker-number" style={{ fontSize: 72, color: "#f59e0b", lineHeight: 1 }}>{daysLeft}</div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", marginTop: 4 }}>{Math.ceil(daysLeft / 7)} WEEKS REMAINING</div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ borderBottom: "1px solid #1e293b", background: "#0a0f1a" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 40px", display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#475569", marginBottom: 6 }}>COMPLETED WORKOUTS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="ticker-number" style={{ fontSize: 32, color: "#e2e8f0" }}>
                {progress.pct}<span style={{ fontSize: 16, color: "#475569" }}>%</span>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div className="phase-bar" style={{ height: 8 }}>
                  <div className="phase-bar-fill" style={{ width: `${progress.pct}%`, background: "linear-gradient(to right, #3b82f6, #a855f7)" }} />
                </div>
                <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>{progress.completed} / {progress.past} past sessions</div>
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 40, background: "#1e293b" }} />

          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#475569", marginBottom: 8 }}>DISCIPLINES</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {Object.entries(DISCIPLINES).filter(([k]) => k !== "rest").map(([key, val]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", fontSize: 10, letterSpacing: "0.1em", color: "#64748b" }}>
                  <span className="discipline-dot" style={{ background: val.color }} />{val.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#4ade80" }}>✓ {Object.keys(workouts).length} WORKOUTS LOADED</div>
        </div>
      </div>

      {/* CALENDAR */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#475569", marginBottom: 4 }}>WEEK VIEW</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.08em", color: "#94a3b8" }}>{weekLabel}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="nav-btn" onClick={() => setWeekOffset(w => w - 1)}>← PREV</button>
            <button className="nav-btn" onClick={() => setWeekOffset(0)} style={{ color: "#f59e0b", borderColor: "#f59e0b40" }}>TODAY</button>
            <button className="nav-btn" onClick={() => setWeekOffset(w => w + 1)}>NEXT →</button>
          </div>
        </div>

        {/* Day cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {dayLabels.map((label, i) => {
            const { date, key, workout } = weekDaysWithWorkouts[i];
            const isToday = key === todayKey;
            const isSelected = selectedDay === key;
            const disc = workout ? DISCIPLINES[workout.type] : DISCIPLINES.rest;
            const isPast = date < today;

            return (
              <div
                key={key}
                className={`day-card${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
                onClick={() => setSelectedDay(isSelected ? null : key)}
                style={{
                  background: disc.bg,
                  padding: "14px 12px",
                  minHeight: 140,
                  position: "relative",
                  opacity: isPast && workout && !workout.completed && workout.type !== "rest" ? 0.5 : 1,
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#475569", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontFamily: "'Bebas Neue', sans-serif", color: isToday ? "#f59e0b" : "#64748b", marginBottom: 10 }}>{date.getDate()}</div>

                {workout && workout.type !== "rest" ? (
                  <>
                    <div style={{ display: "inline-block", fontSize: 8, letterSpacing: "0.15em", color: disc.color, background: disc.color + "18", padding: "2px 6px", marginBottom: 8 }}>
                      {disc.label}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.4, letterSpacing: "0.02em" }}>{workout.label}</div>
                    <div
                      className="completed-check"
                      onClick={e => { e.stopPropagation(); toggleCompletion(key); }}
                      title={workout.completed ? "Mark incomplete" : "Mark complete"}
                      style={{
                        position: "absolute", top: 10, right: 10, width: 16, height: 16,
                        background: workout.completed ? disc.color : "transparent",
                        border: `1px solid ${disc.color}`,
                        borderRadius: "50%", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 9, color: "#000",
                        cursor: "pointer", opacity: workout.completed ? 1 : 0.5,
                        transition: "all 0.2s",
                      }}
                    >{workout.completed ? "✓" : ""}</div>
                  </>
                ) : workout?.type === "rest" ? (
                  <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.05em" }}>REST</div>
                ) : (
                  <div style={{ fontSize: 10, color: "#1e293b", letterSpacing: "0.05em" }}>—</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedDay && workouts[selectedDay] && (
          <div style={{ marginTop: 16, background: "#0d1117", border: `1px solid ${DISCIPLINES[workouts[selectedDay].type]?.color || "#334155"}40`, padding: "20px 24px", display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#475569", marginBottom: 6 }}>SESSION</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: DISCIPLINES[workouts[selectedDay].type]?.color || "#e2e8f0" }}>
                {workouts[selectedDay].label}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#475569", marginBottom: 6 }}>DETAILS</div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{workouts[selectedDay].detail}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#475569", marginBottom: 6 }}>STATUS</div>
              <div style={{ fontSize: 11, color: workouts[selectedDay].completed ? "#4ade80" : "#f59e0b", letterSpacing: "0.1em", marginBottom: 10 }}>
                {workouts[selectedDay].completed ? "✓ COMPLETED" : "… UPCOMING"}
              </div>
              {workouts[selectedDay].type !== "rest" && (
                <button
                  onClick={() => toggleCompletion(selectedDay)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${workouts[selectedDay].completed ? "#4ade8040" : "#4ade80"}`,
                    color: workouts[selectedDay].completed ? "#475569" : "#4ade80",
                    padding: "5px 12px", cursor: "pointer",
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    letterSpacing: "0.1em", transition: "all 0.2s",
                  }}
                >
                  {workouts[selectedDay].completed ? "MARK INCOMPLETE" : "MARK COMPLETE"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Weekly summary */}
        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Object.entries(weeklyStats).map(([type, count]) => {
            const disc = DISCIPLINES[type];
            return (
              <div key={type} style={{ background: "#0a0f1a", border: "1px solid #1e293b", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 3, height: 32, background: disc.color, borderRadius: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#475569", marginBottom: 4 }}>{disc.label}</div>
                  <div className="ticker-number" style={{ fontSize: 28, color: count > 0 ? disc.color : "#334155" }}>
                    {count}<span style={{ fontSize: 12, color: "#475569", marginLeft: 2 }}>sess</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: "1px solid #1e293b", padding: "20px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#1e293b" }}>IRONMAN 2026 · {daysLeft} DAYS OUT</div>
      </div>
    </div>
  );
}
