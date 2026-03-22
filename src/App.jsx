import { useState, useMemo } from "react";
import cachedWorkouts from "./workouts-cache.json";

const RACE_DATE = new Date("2026-11-22");

function MDotLogo({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
      <polygon points="30,1 59,30 30,59 1,30" fill="#e31837" />
      <circle cx="43" cy="17" r="6.5" fill="white" />
    </svg>
  );
}

const DISCIPLINES = {
  swim:  { label: "SWIM",  color: "#38bdf8", bg: "#0d1117" },
  bike:  { label: "BIKE",  color: "#f59e0b", bg: "#0d1117" },
  run:   { label: "RUN",   color: "#4ade80", bg: "#0d1117" },
  rest:  { label: "REST",  color: "#475569", bg: "#0f172a" },
};

// Fixed weekly targets from training plan averages
const WEEKLY_TARGETS = {
  swim: { min: 124, km: 4.931 },   // 2:04 hrs/wk, 4,931 m/wk
  bike: { min: 240, km: 112 },     // 4:00 hrs/wk, 112 km/wk
  run:  { min: 142, km: 25.8 },    // 2:22 hrs/wk, 25.8 km/wk
};

// 32-week plan totals from weekly averages
const PLAN_TOTALS = {
  swim: { min: 124 * 32, km: 4.931 * 32 },
  bike: { min: 240 * 32, km: 112  * 32 },
  run:  { min: 142 * 32, km: 25.8 * 32 },
};

const BADGES = [
  { id: "aluminum", name: "ALUMINUM MAN", fraction: "¼ IRONMAN", color: "#94a3b8", glowColor: "rgba(148,163,184,0.4)", thresholds: { swim: 0.95, bike: 45, run: 10.55 } },
  { id: "tin",      name: "TIN MAN",      fraction: "½ IRONMAN", color: "#7dd3fc", glowColor: "rgba(125,211,252,0.4)", thresholds: { swim: 1.9,  bike: 90,  run: 21.1  } },
  { id: "brass",    name: "BRASS MAN",    fraction: "¾ IRONMAN", color: "#d97706", glowColor: "rgba(217,119,6,0.4)",   thresholds: { swim: 2.85, bike: 135, run: 31.65 } },
  { id: "iron",     name: "IRON MAN",     fraction: "FULL",      color: "#e31837", glowColor: "rgba(227,24,55,0.4)",   thresholds: { swim: 3.8,  bike: 180, run: 42.2  } },
];

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
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7);
  return monday;
}

function getWeekDays(weekOffset) {
  const monday = getWeekStart(weekOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d, key: d.toISOString().split("T")[0] };
  });
}

function formatDuration(minutes) {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatHrsMins(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

// Estimate distance where TP doesn't provide it
function getEffectiveKm(w) {
  if (w.distanceKm) return w.distanceKm;
  if (!w.durationMin) return 0;
  if (w.type === "bike") return (w.durationMin / 60) * 28;     // 28 km/h avg
  if (w.type === "run")  return w.durationMin / 5.75;           // 5:45 min/km avg
  return 0;
}

function getOverallProgress(workouts) {
  const all = Object.values(workouts).filter(w => w.type !== "rest");
  const today = getToday();
  const past = Object.entries(workouts).filter(([k, w]) => w.type !== "rest" && new Date(k) < today);
  const completed = past.filter(([, w]) => w.completed).length;
  return { completed, past: past.length, pct: all.length ? Math.round((completed / all.length) * 100) : 0 };
}

// ─── Small ring gauge ─────────────────────────────────────────────────────────

function SmallGauge({ color, pct, label, completedMin, plannedMin }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(1, Math.max(0, pct)) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative", width: 44, height: 44 }}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
          <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 22 22)" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, color, lineHeight: 1 }}>
            {Math.round(Math.min(1, pct) * 100)}%
          </span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 7, letterSpacing: "0.15em", color: "#64748b" }}>{label}</div>
        {plannedMin > 0 && (
          <div style={{ fontSize: 7, color: "#334155", marginTop: 1 }}>
            {formatDuration(completedMin) || "0min"}/{formatDuration(plannedMin)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Weekly target card ───────────────────────────────────────────────────────

function WeeklyTargetCard({ disc, color, targetMin, targetKm, doneMin }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const pct = targetMin > 0 ? Math.min(1, doneMin / targetMin) : 0;
  const fill = pct * circ;
  const distLabel = targetKm >= 10
    ? `${Math.round(targetKm)} km/wk`
    : targetKm >= 1
      ? `${targetKm.toFixed(1)} km/wk`
      : `${Math.round(targetKm * 1000)} m/wk`;

  return (
    <div style={{
      background: "#0a0f1a",
      border: "1px solid #1e293b",
      borderTop: `2px solid ${color}`,
      padding: "22px 24px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#94a3b8" }}>{disc}</div>
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "#f1f5f9", lineHeight: 1, letterSpacing: "0.02em" }}>
          {formatHrsMins(targetMin)}
        </div>
        <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.12em", marginTop: 3 }}>HRS/WK</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 10, letterSpacing: "0.04em" }}>{distLabel}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", width: 76, height: 76 }}>
          <svg width="76" height="76" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
              transform="rotate(-90 38 38)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color, lineHeight: 1 }}>{Math.round(pct * 100)}%</div>
            <div style={{ fontSize: 7, color: "#475569", letterSpacing: "0.08em" }}>DONE</div>
          </div>
        </div>
        <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.04em" }}>
          {formatDuration(doneMin) || "0min"} done
        </div>
      </div>
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function BadgeRow({ badgeCompletions, toggleBadge }) {
  const [hoveredBadge, setHoveredBadge] = useState(null);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {BADGES.map(badge => {
        const isEarned = !!badgeCompletions[badge.id];
        const isHovered = hoveredBadge === badge.id;
        const isActive = isEarned || isHovered;

        return (
          <div
            key={badge.id}
            onMouseEnter={() => setHoveredBadge(badge.id)}
            onMouseLeave={() => setHoveredBadge(null)}
            style={{
              background: "#0a0f1a",
              border: `1px solid ${isActive ? badge.color + "60" : "#1e293b"}`,
              boxShadow: isActive ? `0 0 0 1px ${badge.glowColor}, 0 0 28px ${badge.glowColor}` : "none",
              padding: "20px 16px 18px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
              filter: isActive ? "none" : "grayscale(1)",
              opacity: isActive ? 1 : 0.45,
              transition: "filter 0.3s ease, opacity 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              border: `2px solid ${badge.color}`,
              background: isEarned ? badge.color + "22" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.3s",
            }}>
              {isEarned ? (
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill={badge.color} />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="#334155" strokeWidth="1.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.08em", color: badge.color, lineHeight: 1 }}>
                {badge.name}
              </div>
              <div style={{ display: "inline-block", marginTop: 5, fontSize: 9, letterSpacing: "0.2em", color: badge.color, background: badge.color + "18", padding: "2px 8px" }}>
                {badge.fraction}
              </div>
            </div>

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 7 }}>
              {["swim", "bike", "run"].map(disc => (
                <div key={disc} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 8, letterSpacing: "0.12em", color: isActive ? DISCIPLINES[disc].color : "#475569", width: 28, flexShrink: 0, transition: "color 0.3s" }}>
                    {disc.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, height: 3, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: DISCIPLINES[disc].color, width: isEarned ? "100%" : "0%", transition: "width 0.8s ease" }} />
                  </div>
                  <div style={{ fontSize: 8, color: isActive ? "#64748b" : "#334155", width: 48, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap", letterSpacing: "0.02em", transition: "color 0.3s" }}>
                    {badge.thresholds[disc]}km
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => toggleBadge(badge.id)}
              style={{
                width: "100%",
                background: isEarned ? badge.color + "18" : "transparent",
                border: `1px solid ${isEarned ? badge.color + "60" : "#334155"}`,
                color: isEarned ? badge.color : "#475569",
                padding: "5px 10px", cursor: "pointer",
                fontFamily: "'DM Mono', monospace", fontSize: 9,
                letterSpacing: "0.1em", transition: "all 0.2s",
              }}
            >
              {isEarned ? "✓ EARNED" : "MARK EARNED"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IronmanTracker() {
  const [completions, setCompletions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ironman-completions") || "{}"); }
    catch { return {}; }
  });
  const [badgeCompletions, setBadgeCompletions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ironman-badges") || "{}"); }
    catch { return {}; }
  });
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);

  const workouts = useMemo(() => {
    const merged = {};
    for (const [key, w] of Object.entries(cachedWorkouts)) {
      merged[key] = { ...w, completed: completions[key] !== undefined ? completions[key] : w.completed };
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

  function toggleBadge(badgeId) {
    setBadgeCompletions(prev => {
      const next = { ...prev, [badgeId]: !prev[badgeId] };
      localStorage.setItem("ironman-badges", JSON.stringify(next));
      return next;
    });
  }

  const today = getToday();
  const todayKey = today.toISOString().split("T")[0];
  const daysLeft = getDaysUntilRace();
  const progress = getOverallProgress(workouts);
  const weekDays = getWeekDays(weekOffset);
  const weekDaysWithWorkouts = weekDays.map(d => ({ ...d, workout: workouts[d.key] }));

  // Current week stats (always offset=0) for gauges and targets
  const currentWeekDays = getWeekDays(0).map(d => ({ ...d, workout: workouts[d.key] }));
  const thisWeekStats = {};
  for (const type of ["swim", "bike", "run"]) {
    const days = currentWeekDays.filter(({ workout: w }) => w?.type === type);
    const planned = days.reduce((s, { workout: w }) => s + (w?.durationMin || 0), 0);
    const done = days.filter(({ workout: w }) => w?.completed).reduce((s, { workout: w }) => s + (w?.durationMin || 0), 0);
    thisWeekStats[type] = { planned, done };
  }
  const hasThisWeek = Object.values(thisWeekStats).some(s => s.planned > 0);

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
        .completed-check { animation: popIn 0.3s ease; }
        .completed-check:hover { opacity: 1 !important; transform: scale(1.15); }
        @keyframes popIn { 0% { transform: scale(0); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(180deg, #0d1117 0%, #080c14 100%)", borderBottom: "1px solid #1e293b", padding: "32px 40px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <MDotLogo size={64} />
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
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 40px", display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
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

          <div style={{ width: 1, height: 48, background: "#1e293b", flexShrink: 0 }} />

          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#94a3b8", marginBottom: 10 }}>THIS WEEK</div>
            {hasThisWeek ? (
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                {["swim", "bike", "run"].map(type => {
                  const { planned, done } = thisWeekStats[type];
                  if (!planned) return null;
                  return (
                    <SmallGauge key={type} color={DISCIPLINES[type].color}
                      pct={done / planned} label={DISCIPLINES[type].label}
                      completedMin={done} plannedMin={planned} />
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: "#334155" }}>No sessions planned</div>
            )}
          </div>

          <div style={{ width: 1, height: 48, background: "#1e293b", flexShrink: 0 }} />

          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#4ade80" }}>✓ {Object.keys(workouts).length} SESSIONS LOADED</div>
        </div>
      </div>

      {/* TODAY'S WORKOUT SPOTLIGHT */}
      {workouts[todayKey] && workouts[todayKey].type !== "rest" && (() => {
        const w = workouts[todayKey];
        const disc = DISCIPLINES[w.type];
        return (
          <div style={{ borderBottom: "1px solid #1e293b", background: disc.color + "12" }}>
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
              <div style={{ display: "inline-block", fontSize: 8, letterSpacing: "0.15em", color: disc.color, background: disc.color + "20", padding: "3px 8px" }}>{disc.label}</div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 11, color: w.completed ? "#4ade80" : "#f59e0b", letterSpacing: "0.15em" }}>
                  {w.completed ? "✓ DONE" : "● TO DO"}
                </div>
                <button onClick={() => toggleCompletion(todayKey)} style={{
                  background: w.completed ? "#1e293b" : disc.color + "22",
                  border: `1px solid ${w.completed ? "#334155" : disc.color}`,
                  color: w.completed ? "#64748b" : disc.color,
                  padding: "6px 14px", cursor: "pointer",
                  fontFamily: "'DM Mono', monospace", fontSize: 10,
                  letterSpacing: "0.1em", transition: "all 0.2s",
                }}>{w.completed ? "MARK INCOMPLETE" : "MARK COMPLETE"}</button>
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
          <div style={{ display: "flex", gap: 8 }}>
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
            // Uniform dark bg for all days; rest gets slightly different shade
            const cardBg = disc.bg;

            return (
              <div key={key}
                className={`day-card${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
                onClick={() => setSelectedDay(isSelected ? null : key)}
                style={{
                  background: cardBg, padding: "14px 12px", minHeight: 140,
                  position: "relative",
                  opacity: isPast && workout && !workout.completed && workout.type !== "rest" ? 0.5 : 1,
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#64748b", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontFamily: "'Bebas Neue', sans-serif", color: isToday ? "#f59e0b" : "#64748b", marginBottom: 10 }}>{date.getDate()}</div>

                {workout && workout.type !== "rest" ? (
                  <>
                    <div style={{ display: "inline-block", fontSize: 8, letterSpacing: "0.15em", color: disc.color, background: disc.color + "20", border: `1px solid ${disc.color}30`, padding: "2px 6px", marginBottom: 8, borderRadius: 2 }}>
                      {disc.label}
                    </div>
                    <div style={{ fontSize: 10, color: "#e2e8f0", lineHeight: 1.4, letterSpacing: "0.02em", marginBottom: workout.durationMin ? 4 : 0 }}>
                      {workout.label}
                    </div>
                    {workout.durationMin && (
                      <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.05em" }}>
                        {formatDuration(workout.durationMin)}
                        {workout.distanceKm ? ` · ${workout.distanceKm.toFixed(1)}km` : ""}
                      </div>
                    )}
                    <div className="completed-check" onClick={e => { e.stopPropagation(); toggleCompletion(key); }}
                      title={workout.completed ? "Mark incomplete" : "Mark complete"}
                      style={{
                        position: "absolute", top: 10, right: 10, width: 16, height: 16,
                        background: workout.completed ? disc.color : "transparent",
                        border: `1px solid ${disc.color}`,
                        borderRadius: "50%", display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 9, color: "#000",
                        cursor: "pointer", opacity: workout.completed ? 1 : 0.4, transition: "all 0.2s",
                      }}
                    >{workout.completed ? "✓" : ""}</div>
                  </>
                ) : workout?.type === "rest" ? (
                  <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.05em" }}>REST</div>
                ) : (
                  <div style={{ fontSize: 10, color: "#1e293b" }}>—</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedDay && workouts[selectedDay] && (
          <div style={{ marginTop: 16, background: "#0d1117", border: `1px solid ${DISCIPLINES[workouts[selectedDay].type]?.color || "#334155"}30`, padding: "24px 28px" }}>
            <div style={{ display: "flex", gap: 48, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
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
                  <button onClick={() => toggleCompletion(selectedDay)} style={{
                    background: "transparent",
                    border: `1px solid ${workouts[selectedDay].completed ? "#4ade8040" : "#4ade80"}`,
                    color: workouts[selectedDay].completed ? "#64748b" : "#4ade80",
                    padding: "5px 12px", cursor: "pointer",
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    letterSpacing: "0.1em", transition: "all 0.2s",
                  }}>
                    {workouts[selectedDay].completed ? "MARK INCOMPLETE" : "MARK COMPLETE"}
                  </button>
                )}
              </div>
            </div>
            {workouts[selectedDay].description && (
              <div style={{ borderTop: "1px solid #1e293b", paddingTop: 16 }}>
                <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 10 }}>WORKOUT DETAILS</div>
                <pre style={{
                  fontFamily: "'DM Mono', 'Courier New', monospace",
                  fontSize: 10, color: "#94a3b8", lineHeight: 1.8,
                  whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
                }}>{workouts[selectedDay].description}</pre>
              </div>
            )}
          </div>
        )}

        {/* LESSER METALS */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 16 }}>LESSER METALS</div>
          <BadgeRow badgeCompletions={badgeCompletions} toggleBadge={toggleBadge} />
        </div>

        {/* WEEKLY TARGETS */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 16 }}>WEEKLY TARGETS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {["swim", "bike", "run"].map(type => (
              <WeeklyTargetCard
                key={type}
                disc={DISCIPLINES[type].label}
                color={DISCIPLINES[type].color}
                targetMin={WEEKLY_TARGETS[type].min}
                targetKm={WEEKLY_TARGETS[type].km}
                doneMin={thisWeekStats[type]?.done || 0}
              />
            ))}
          </div>
        </div>

        {/* NEXT UP */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 16 }}>NEXT UP</div>
          {upcomingSessions.length === 0 ? (
            <div style={{ fontSize: 11, color: "#334155" }}>No upcoming sessions</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {upcomingSessions.map(([key, w], idx) => {
                const disc = DISCIPLINES[w.type];
                const diff = Math.round((new Date(key) - today) / 864e5);
                const dayLabel = diff === 0 ? "TODAY" : diff === 1 ? "TOMORROW"
                  : new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
                return (
                  <div key={key} style={{
                    background: "#0a0f1a", border: "1px solid #1e293b",
                    borderTop: `2px solid ${disc.color}`,
                    padding: "14px 16px", opacity: idx === 0 ? 1 : 0.6,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 8, letterSpacing: "0.15em", color: disc.color }}>{disc.label}</div>
                      <div style={{ fontSize: 8, color: "#475569", letterSpacing: "0.04em" }}>{dayLabel}</div>
                    </div>
                    <div style={{ fontSize: 10, color: "#cbd5e1", lineHeight: 1.4, letterSpacing: "0.02em", marginBottom: 6 }}>{w.label}</div>
                    {w.durationMin && (
                      <div style={{ fontSize: 9, color: "#64748b", letterSpacing: "0.04em" }}>
                        {formatDuration(w.durationMin)}{w.distanceKm ? ` · ${w.distanceKm.toFixed(1)} km` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TOTAL TRAINING VOLUME */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#94a3b8", marginBottom: 16 }}>TOTAL TRAINING VOLUME <span style={{ color: "#334155", letterSpacing: "0.1em", fontSize: 9 }}>· 32-WEEK PLAN</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {["swim", "bike", "run"].map(type => {
              const { min, km } = PLAN_TOTALS[type];
              const disc = DISCIPLINES[type];
              return (
                <div key={type} style={{ background: "#0a0f1a", border: `1px solid ${disc.color}25`, padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 3, height: 16, background: disc.color, borderRadius: 2 }} />
                    <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#94a3b8" }}>{disc.label}</div>
                  </div>
                  <div className="ticker-number" style={{ fontSize: 28, color: disc.color, marginBottom: 4 }}>
                    {formatHrsMins(min)}
                  </div>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.08em", marginBottom: 8 }}>TOTAL HOURS</div>
                  <div style={{ fontSize: 11, color: "#64748b", letterSpacing: "0.04em" }}>
                    {km >= 1000 ? `${(km / 1000).toFixed(1)}k km` : `${Math.round(km)} km`}
                  </div>
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
