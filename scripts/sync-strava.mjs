#!/usr/bin/env node
// Fetches YTD activities from Strava API and writes src/strava-actuals.json

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

// ── 1. Get a fresh access token ──────────────────────────────────────────────
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

// ── 3. Bucket by discipline ──────────────────────────────────────────────────
const buckets = {
  swim:  { count: 0, min: 0, km: 0 },
  bike:  { count: 0, min: 0, km: 0 },
  run:   { count: 0, min: 0, km: 0 },
  other: { count: 0, min: 0, km: 0 },
};

for (const a of activities) {
  const type = (a.sport_type || a.type || "").toLowerCase();
  const min  = Math.round((a.moving_time || 0) / 60);
  const km   = (a.distance || 0) / 1000;

  let bucket = "other";
  if (type === "swim")                                          bucket = "swim";
  else if (["ride", "virtualride", "ebikeride"].includes(type)) bucket = "bike";
  else if (["run", "virtualrun", "trailrun"].includes(type))    bucket = "run";

  buckets[bucket].count++;
  buckets[bucket].min += min;
  buckets[bucket].km  += km;
}

// Round km to 2dp
for (const v of Object.values(buckets)) v.km = Math.round(v.km * 100) / 100;

// ── 4. Write output ──────────────────────────────────────────────────────────
const out = { updatedAt: new Date().toISOString(), ytd: buckets };
writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));

const total = Object.values(buckets).reduce((s, v) => s + v.min, 0);
console.log(`✓ Written to strava-actuals.json`);
console.log(`  Swim  ${buckets.swim.count} acts  ${buckets.swim.min} min  ${buckets.swim.km} km`);
console.log(`  Bike  ${buckets.bike.count} acts  ${buckets.bike.min} min  ${buckets.bike.km} km`);
console.log(`  Run   ${buckets.run.count} acts  ${buckets.run.min} min  ${buckets.run.km} km`);
console.log(`  Other ${buckets.other.count} acts  ${buckets.other.min} min`);
console.log(`  Total ${total} min`);
