import { useState, useMemo } from "react";
import cachedWorkouts from "./workouts-cache.json";

const RACE_DATE = new Date("2026-11-22");
const IRONMAN_LOGO = "https://www.ironman.com/sites/default/files/styles/logo/public/2024-11/IRONMAN%20M-Dot%C2%AEv2-02.png?itok=zE3r9TX3";

const DISCIPLINES = {
  swim:  { label: "SWIM",  color: "#38bdf8", bg: "#0c1a2e" },
  bike:  { label: "BIKE",  color: "#a3e635", bg: "#0f1e07" },
  run:   { label: "RUN",   color: "#fb923c", bg: "#1f0e04" },
  brick: { label: "BRICK", color: "#c084fc", bg: "#160b21" },
  rest:  { label: "REST",  color: "#475569", bg: "#0f172a" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const dow = today.getDay();
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

function formatDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const RACE_TARGETS = { swim: 3.8, bike: 180, run: 42.2 };

function getOverallProgress(workouts) {
  const all = Object.values(workouts).filter(w => w.type !== "rest");
  const today = getToday();
  const past = Object.entries(workouts).filter(([k, w]) => w.type !== "rest" && new Date(k) < today);
  const completed = past.filter(([, w]) => w.completed).length;
  return { completed, total: all.length, past: past.length, pct: all.length ? Math.round((completed / all.length) * 100) : 0 };
}

function getTotals(workouts) {
  const totals = { swim: { km: 0, min: 0 }, bike: { km: 0, min: 0 }, run: { km: 0, min: 0 }, brick: { km: 0, min: 0 } };
  for (const w of Object.values(workouts)) {
    if (!w.completed || !totals[w.type]) continue;
    if (w.distanceKm) totals[w.type].km += w.distanceKm;
    if (w.durationMin) totals[w.type].min += w.durationMin;
  }
  return totals;
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
  const totals = getTotals(workouts);
  const weekDays = getWeekDays(weekOffset);
  const weekDaysWithWorkouts = weekDays.map(d => ({ ...d, workout: workouts[d.key] }));

  // Weekly load chart data
  const weeklyLoad = {};
  for (const [key, w] of Object.entries(workouts)) {
    const d = new Date(key);
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk = mon.toISOString().split("T")[0];
    if (!weeklyLoad[wk]) weeklyLoad[wk] = { swim: 0, bike: 0, run: 0, brick: 0 };
    if (w.durationMin && weeklyLoad[wk][w.type] !== undefined)
      weeklyLoad[wk][w.type] += w.durationMin;
  }
  const loadWeeks = Object.keys(weeklyLoad).sort();
  const loadTotals = loadWeeks.map(wk => ["swim", "bike", "run", "brick"].reduce((s, t) => s + weeklyLoad[wk][t], 0));
  const maxLoad = Math.max(...loadTotals, 1);
  const currentWeekKey = (() => {
    const t = getToday();
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return t.toISOString().split("T")[0];
  })();

  // Upcoming sessions
  const upcomingSessions = Object.entries(workouts)
    .filter(([k, w]) => !w.completed && w.type !== "rest" && new Date(k) >= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5);

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
        .day-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.5); border-color: #475569; }
        .day-card.today { border-color: #f59e0b !important; box-shadow: 0 0 0 1px #f59e0b40; }
        .day-card.selected { border-color: #60a5fa !important; box-shadow: 0 0 0 1px #60a5fa40; }
        .phase-bar { position: relative; height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden; }
        .phase-bar-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
        .nav-btn { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 6px 14px; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.1em; transition: all 0.15s; }
        .nav-btn:hover { background: #334155; color: #f1f5f9; }
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
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <img
                src={IRONMAN_LOGO}
                alt="IRONMAN"
                style={{ height: 64, width: "auto", objectFit: "contain" }}
              />
              <div>
                <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 6 }}>TRAINING TRACKER</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: "0.04em", lineHeight: 1, color: "#f1f5f9" }}>ROAD TO IRON</div>
                <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#94a3b8", marginTop: 6 }}>
                  {RACE_DATE.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()} · FULL IRONMAN
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 4 }}>DAYS UNTIL RACE</div>
              <div className="ticker-number" style={{ fontSize: 72, color: "#f59e0b", lineHeight: 1 }}>{daysLeft}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.2em", marginTop: 4 }}>{Math.ceil(daysLeft / 7)} WEEKS REMAINING</div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ borderBottom: "1px solid #1e293b", background: "#0a0f1a" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 40px", display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#94a3b8", marginBottom: 6 }}>COMPLETED WORKOUTS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="ticker-number" style={{ fontSize: 32, color: "#f1f5f9" }}>
                {progress.pct}<span style={{ fontSize: 16, color: "#94a3b8" }}>%</span>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div className="phase-bar" style={{ height: 8 }}>
                  <div className="phase-bar-fill" style={{ width: `${progress.pct}%`, background: "linear-gradient(to right, #3b82f6, #a855f7)" }} />
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{progress.completed} / {progress.past} past sessions</div>
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 40, background: "#1e293b" }} />

          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#94a3b8", marginBottom: 6 }}>THIS WEEK</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {["swim", "bike", "run", "brick"].map(type => {
                const thisWeekKey = (() => { const t = getToday(); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().split("T")[0]; })();
                const mins = weekDaysWithWorkouts.filter(({ workout: w }) => w?.type === type).reduce((s, { workout: w }) => s + (w.durationMin || 0), 0);
                if (!mins) return null;
                return (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#cbd5e1", letterSpacing: "0.05em" }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, background: DISCIPLINES[type].color, borderRadius: 1 }} />
                    {formatDuration(mins)}
                  </div>
                );
              })}
              {weekDaysWithWorkouts.every(({ workout: w }) => !w || w.type === "rest" || !w.durationMin) && (
                <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.05em" }}>No sessions planned</div>
              )}
            </div>
          </div>

          <div style={{ width: 1, height: 40, background: "#1e293b" }} />

          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#4ade80" }}>✓ {Object.keys(workouts).length} SESSIONS LOADED</div>
        </div>
      </div>

      {/* TODAY'S WORKOUT SPOTLIGHT */}
      {workouts[todayKey] && workouts[todayKey].type !== "rest" && (() => {
        const w = workouts[todayKey];
        const disc = DISCIPLINES[w.type];
        return (
          <div style={{ borderBottom: "1px solid #1e293b", background: disc.bg }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 40px", display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 3, height: 48, background: disc.color, borderRadius: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 2 }}>TODAY'S SESSION</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: "0.06em", color: disc.color, lineHeight: 1 }}>{w.label}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, letterSpacing: "0.05em" }}>
                    {w.durationMin ? formatDuration(w.durationMin) : ""}
                    {w.distanceKm ? ` · ${w.distanceKm.toFixed(1)} km` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "inline-block", fontSize: 8, letterSpacing: "0.15em", color: disc.color, background: disc.color + "18", padding: "3px 8px" }}>{disc.label}</div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 11, color: w.completed ? "#4ade80" : "#f59e0b", letterSpacing: "0.15em" }}>
                  {w.completed ? "✓ DONE" : "● TO DO"}
                </div>
                <button
                  onClick={() => toggleCompletion(todayKey)}
                  style={{
                    background: w.completed ? "#1e293b" : disc.color + "22",
                    border: `1px solid ${w.completed ? "#334155" : disc.color}`,
                    color: w.completed ? "#64748b" : disc.color,
                    padding: "6px 14px", cursor: "pointer",
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    letterSpacing: "0.1em", transition: "all 0.2s",
                  }}
                >{w.completed ? "MARK INCOMPLETE" : "MARK COMPLETE"}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CALENDAR */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 4 }}>WEEK VIEW</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.08em", color: "#e2e8f0" }}>{weekLabel}</div>
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
                <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#94a3b8", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontFamily: "'Bebas Neue', sans-serif", color: isToday ? "#f59e0b" : "#94a3b8", marginBottom: 10 }}>{date.getDate()}</div>

                {workout && workout.type !== "rest" ? (
                  <>
                    <div style={{ display: "inline-block", fontSize: 8, letterSpacing: "0.15em", color: disc.color, background: disc.color + "18", padding: "2px 6px", marginBottom: 8 }}>
                      {disc.label}
                    </div>
                    <div style={{ fontSize: 10, color: "#e2e8f0", lineHeight: 1.4, letterSpacing: "0.02em", marginBottom: workout.durationMin ? 4 : 0 }}>
                      {workout.label}
                    </div>
                    {workout.durationMin && (
                      <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: "0.05em" }}>
                        {formatDuration(workout.durationMin)}
                        {workout.distanceKm ? ` · ${workout.distanceKm.toFixed(1)}km` : ""}
                      </div>
                    )}
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
                        cursor: "pointer", opacity: workout.completed ? 1 : 0.4,
                        transition: "all 0.2s",
                      }}
                    >{workout.completed ? "✓" : ""}</div>
                  </>
                ) : workout?.type === "rest" ? (
                  <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.05em" }}>REST</div>
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
              <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 6 }}>SESSION</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: DISCIPLINES[workouts[selectedDay].type]?.color || "#e2e8f0" }}>
                {workouts[selectedDay].label}
              </div>
              {workouts[selectedDay].durationMin && (
                <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 6, letterSpacing: "0.05em" }}>
                  {formatDuration(workouts[selectedDay].durationMin)}
                  {workouts[selectedDay].distanceKm ? ` · ${workouts[selectedDay].distanceKm.toFixed(2)} km` : ""}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 6 }}>STATUS</div>
              <div style={{ fontSize: 11, color: workouts[selectedDay].completed ? "#4ade80" : "#f59e0b", letterSpacing: "0.1em", marginBottom: 10 }}>
                {workouts[selectedDay].completed ? "✓ COMPLETED" : "… UPCOMING"}
              </div>
              {workouts[selectedDay].type !== "rest" && (
                <button
                  onClick={() => toggleCompletion(selectedDay)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${workouts[selectedDay].completed ? "#4ade8040" : "#4ade80"}`,
                    color: workouts[selectedDay].completed ? "#64748b" : "#4ade80",
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

        {/* TRAINING LOAD + UPCOMING */}
        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>

          {/* Weekly load chart */}
          <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", padding: "20px 24px" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 20 }}>WEEKLY TRAINING LOAD</div>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 100 }}>
              {loadWeeks.map((wk, i) => {
                const load = weeklyLoad[wk];
                const total = loadTotals[i];
                const isCurrent = wk === currentWeekKey;
                const isPast = wk < currentWeekKey;
                const barH = Math.max(2, Math.round((total / maxLoad) * 80));
                return (
                  <div key={wk} title={`${new Date(wk + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${(total / 60).toFixed(1)}h`}
                    style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch", cursor: "default" }}>
                    <div style={{ display: "flex", flexDirection: "column-reverse", height: 80 }}>
                      {["run", "bike", "swim", "brick"].map(type => {
                        if (!load[type]) return null;
                        const segH = Math.max(1, Math.round((load[type] / maxLoad) * 80));
                        return (
                          <div key={type} style={{
                            height: segH,
                            background: DISCIPLINES[type].color,
                            opacity: isPast ? 0.35 : isCurrent ? 1 : 0.7,
                          }} />
                        );
                      })}
                      {total === 0 && <div style={{ height: 2, background: "#1e293b", borderRadius: 1, marginTop: "auto" }} />}
                    </div>
                    <div style={{
                      fontSize: 7, textAlign: "center", marginTop: 5, letterSpacing: "0.04em",
                      color: isCurrent ? "#f59e0b" : "#334155",
                      borderTop: isCurrent ? "1px solid #f59e0b50" : "1px solid transparent",
                      paddingTop: 3,
                    }}>
                      {new Date(wk + "T12:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <div style={{ fontSize: 9, color: "#1e293b" }}>0h</div>
              <div style={{ display: "flex", gap: 10 }}>
                {["swim", "bike", "run", "brick"].map(t => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: "#475569", letterSpacing: "0.05em" }}>
                    <div style={{ width: 6, height: 6, background: DISCIPLINES[t].color, opacity: 0.7 }} />
                    {DISCIPLINES[t].label}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.05em" }}>{(maxLoad / 60).toFixed(1)}h peak</div>
            </div>
          </div>

          {/* Next up */}
          <div style={{ background: "#0a0f1a", border: "1px solid #1e293b", padding: "20px 24px" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 16 }}>NEXT UP</div>
            {upcomingSessions.length === 0 ? (
              <div style={{ fontSize: 11, color: "#334155", letterSpacing: "0.05em" }}>No upcoming sessions</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {upcomingSessions.map(([key, w], idx) => {
                  const disc = DISCIPLINES[w.type];
                  const diff = Math.round((new Date(key) - today) / 864e5);
                  const dayLabel = diff === 0 ? "TODAY" : diff === 1 ? "TOMORROW"
                    : new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
                  return (
                    <div key={key} style={{ display: "flex", gap: 10, opacity: idx === 0 ? 1 : 0.55 }}>
                      <div style={{ width: 2, background: disc.color, borderRadius: 1, flexShrink: 0, alignSelf: "stretch" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <div style={{ fontSize: 8, letterSpacing: "0.15em", color: disc.color }}>{disc.label}</div>
                          <div style={{ fontSize: 8, color: idx === 0 ? "#94a3b8" : "#475569", letterSpacing: "0.04em" }}>{dayLabel}</div>
                        </div>
                        <div style={{ fontSize: 10, color: "#cbd5e1", letterSpacing: "0.02em", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.label}</div>
                        {w.durationMin && (
                          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2, letterSpacing: "0.04em" }}>
                            {formatDuration(w.durationMin)}{w.distanceKm ? ` · ${w.distanceKm.toFixed(1)} km` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* All-time totals */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 16 }}>COMPLETED TOTALS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {Object.entries(totals).map(([type, { km, min }]) => {
              const disc = DISCIPLINES[type];
              const hasData = km > 0 || min > 0;
              const target = RACE_TARGETS[type] ?? null;
              const kmPct = target && km > 0 ? Math.min(100, Math.round((km / target) * 100)) : 0;
              return (
                <div key={type} style={{ background: "#0a0f1a", border: `1px solid ${hasData ? disc.color + "30" : "#1e293b"}`, padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 3, height: 16, background: disc.color, borderRadius: 2 }} />
                    <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#94a3b8" }}>{disc.label}</div>
                  </div>
                  {min > 0 ? (
                    <div className="ticker-number" style={{ fontSize: 24, color: disc.color, marginBottom: 4 }}>
                      {formatDuration(min)}
                    </div>
                  ) : (
                    <div className="ticker-number" style={{ fontSize: 24, color: "#334155" }}>—</div>
                  )}
                  {target ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b", letterSpacing: "0.05em", marginBottom: 4 }}>
                        <span>{km > 0 ? `${km.toFixed(1)} km` : "0 km"}</span>
                        <span style={{ color: "#334155" }}>{target} km</span>
                      </div>
                      <div className="phase-bar">
                        <div className="phase-bar-fill" style={{ width: `${kmPct}%`, background: disc.color }} />
                      </div>
                      <div style={{ fontSize: 9, color: kmPct > 0 ? disc.color : "#334155", marginTop: 3, letterSpacing: "0.05em" }}>
                        {kmPct}% OF RACE DIST
                      </div>
                    </div>
                  ) : km > 0 ? (
                    <div style={{ fontSize: 10, color: "#cbd5e1", letterSpacing: "0.05em" }}>{km.toFixed(1)} km</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: "1px solid #1e293b", padding: "20px 40px", textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#334155" }}>IRONMAN 2026 · {daysLeft} DAYS OUT</div>
      </div>
    </div>
  );
}
