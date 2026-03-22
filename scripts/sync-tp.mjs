#!/usr/bin/env node
// Fetches the TrainingPeaks iCal feed and merges new events into
// src/workouts-cache.json so the app accumulates the full plan over time.

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const ICAL_URL = "https://www.trainingpeaks.com/ical/Y5Q2UNBVMFFWE.ics";
const __dir = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dir, "../src/workouts-cache.json");

function unfold(text) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseICS(text) {
  const lines = unfold(text).split(/\r\n|\n/);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).split(";")[0];
      current[key] = line.substring(colonIdx + 1);
    }
  }
  return events;
}

function icsDateToKey(dtstart) {
  const d = (dtstart || "").replace(/T.*/, "");
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function cleanDescription(raw) {
  if (!raw) return "";
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("http") && !l.startsWith("https") &&
      !l.startsWith("Next Step") && !l.startsWith("Watch this") &&
      !l.startsWith("QUICK STEPS") && !l.startsWith("✅"))
    .slice(0, 4)
    .join(" · ")
    .substring(0, 220);
}

function eventsToWorkouts(events) {
  const workouts = {};
  for (const ev of events) {
    const summary = ev.SUMMARY || "";
    const description = ev.DESCRIPTION || "";
    const dtstart = ev.DTSTART || "";
    const dateKey = icsDateToKey(dtstart);
    if (!dateKey || dateKey === "--") continue;

    const summaryLower = summary.toLowerCase();
    let type = "rest";
    if (summaryLower.startsWith("swim")) type = "swim";
    else if (summaryLower.startsWith("bike") || summaryLower.startsWith("cycling")) type = "bike";
    else if (summaryLower.startsWith("run")) type = "run";
    else if (summaryLower.startsWith("brick") || summaryLower.startsWith("multisport")) type = "brick";
    else if (summaryLower.startsWith("day off") || summaryLower.startsWith("rest")) type = "rest";

    const colonIdx = summary.indexOf(":");
    const label = colonIdx >= 0 ? summary.slice(colonIdx + 1).trim() : summary;

    const statsLines = description
      .replace(/\\n/g, "\n")
      .split("\n")
      .filter(l => l.match(/^(Actual|Planned|Distance|Speed|Pace)/));

    const detail = statsLines.length > 0
      ? statsLines.slice(0, 3).join(" · ")
      : cleanDescription(description);

    const completed = description.includes("Actual Time:");

    workouts[dateKey] = { type, label, detail, completed };
  }
  return workouts;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Fetching ${ICAL_URL}`);

  const res = await fetch(ICAL_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();

  const events = parseICS(text);
  const fresh = eventsToWorkouts(events);

  const existing = existsSync(CACHE_PATH)
    ? JSON.parse(readFileSync(CACHE_PATH, "utf8"))
    : {};

  // Merge: fresh data wins (handles completions updating)
  const merged = { ...existing, ...fresh };

  writeFileSync(CACHE_PATH, JSON.stringify(merged, null, 2));

  const newKeys = Object.keys(fresh).filter(k => !existing[k]);
  console.log(`✓ ${Object.keys(merged).length} total workouts cached (+${newKeys.length} new)`);
  if (newKeys.length) console.log("  New dates:", newKeys.join(", "));
}

main().catch(err => { console.error("Sync failed:", err.message); process.exit(1); });
