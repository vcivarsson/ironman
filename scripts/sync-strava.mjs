#!/usr/bin/env node
// Fetches YTD activities from Strava API and writes src/strava-actuals.json
// Stores both aggregate totals (for barometer/volume cards) and per-date
// activities (so the app can mark calendar days as completed automatically).

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dir, "../src/strava-actuals.json");

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("Missing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, or STRAVA_REFRESH_TOKEN");
  process.exit(1);
}

// ── 1. Fresh access token ────────────────────────────────────────────────────
const tokenRes = await fetch("https://www.strava.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
const { access_token } = await tokenRes.json();
console.log("✓ Access token obtained");

// ── 2. Fetch all activities since Jan 1, 2026 ────────────────────────────────
const YEAR_START = Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000);
const activities = [];
let page = 1;

while (true) {
  const url = `https://www.strava.com/api/v3/athlete/activities?after=${YEAR_START}&per_page=100&page=${page}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!res.ok) throw new Error(`Activities fetch failed: ${res.status}`);
  const batch = await res.json();
  if (!batch.length) break;
  activities.push(...batch);
  page++;
}
console.log(`✓ Fetched ${activities.length} activities since Jan 1 2026`);

// ── 3. Classify discipline ───────────────────────────────────────────────────
function classify(sportType) {
  const t = (sportType || "").toLowerCase();
  if (t === "swim") return "swim";
  if (["ride", "virtualride", "ebikeride", "cycling"].includes(t)) return "bike";
  if (["run", "virtualrun", "trailrun"].includes(t)) return "run";
  return "other";
}

// ── 4. Aggregate YTD totals ──────────────────────────────────────────────────
const ytd = {
  swim:  { count: 0, min: 0, km: 0 },
  bike:  { count: 0, min: 0, km: 0 },
  run:   { count: 0, min: 0, km: 0 },
  other: { count: 0, min: 0, km: 0 },
};

// ── 5. Per-date activity log (array per date, all disciplines) ───────────────
const byDate = {};

for (const a of activities) {
  const disc  = classify(a.sport_type || a.type);
  const min   = Math.round((a.moving_time || 0) / 60);
  const km    = Math.round((a.distance   || 0) / 100) / 10;

  // Aggregate
  ytd[disc].count++;
  ytd[disc].min += min;
  ytd[disc].km  += km;

  // Per-date (use start_date_local — Strava stores athlete local time here)
  const dateKey = (a.start_date_local || "").split("T")[0];
  if (!dateKey) continue;
  if (!byDate[dateKey]) byDate[dateKey] = [];
  byDate[dateKey].push({
    type:        disc,
    label:       a.name,
    durationMin: min,
    distanceKm:  km,
    stravaId:    a.id,
  });
}

// Round km totals
for (const v of Object.values(ytd)) v.km = Math.round(v.km * 100) / 100;

// ── 6. Write output ──────────────────────────────────────────────────────────
const out = { updatedAt: new Date().toISOString(), ytd, byDate };
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

const total = Object.values(ytd).reduce((s, v) => s + v.min, 0);
console.log(`✓ Written to strava-actuals.json`);
console.log(`  Swim  ${ytd.swim.count} acts  ${ytd.swim.min} min  ${ytd.swim.km} km`);
console.log(`  Bike  ${ytd.bike.count} acts  ${ytd.bike.min} min  ${ytd.bike.km} km`);
console.log(`  Run   ${ytd.run.count} acts  ${ytd.run.min} min  ${ytd.run.km} km`);
console.log(`  Other ${ytd.other.count} acts  ${ytd.other.min} min`);
console.log(`  Total ${total} min across ${Object.keys(byDate).length} active days`);
