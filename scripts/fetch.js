#!/usr/bin/env node
/**
 * KCC Grand Prix — data collector.
 *
 * Reads config.json, asks the GitHub Search API what each racer merged, closed
 * and reviewed inside the period, and writes:
 *   data.json  (for anything that wants to consume it)
 *   data.js    (same payload as window.RACE_DATA, so index.html works from file://)
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_xxx node scripts/fetch.js
 *   node scripts/fetch.js --demo            # no network, plausible fake race
 *   node scripts/fetch.js --since=2026-08-01 --until=2026-08-31
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARS, DEFAULT_CAR, carSpeed, paint } from "./cars.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.github.com";

/* ------------------------------------------------------------------ args */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : v];
  })
);

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const DEMO = Boolean(args.demo);
const MAX_PAGES = Number(args.pages || 3);          // 100 items per page
const THROTTLE_MS = TOKEN ? 700 : 2200;             // search API: 30/min authed, 10/min not

/* ---------------------------------------------------------------- helpers */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

function daysBetween(since, until) {
  const out = [];
  const d = new Date(since + "T00:00:00Z");
  const end = new Date(until + "T00:00:00Z");
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function scopeQualifier(scope = {}) {
  const parts = [];
  for (const org of scope.orgs || []) parts.push(`org:${org}`);
  for (const repo of scope.repos || []) parts.push(`repo:${repo}`);
  return parts.join(" ");
}

function repoFromUrl(url = "") {
  const m = url.match(/repos\/([^/]+\/[^/]+)/);
  return m ? m[1] : "";
}

/* ------------------------------------------------------------ github calls */

async function searchIssues(q, label) {
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${API}/search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${page}&advanced_search=true`;
    const res = await request(url, label);
    items.push(...(res.items || []));
    if (!res.items || res.items.length < 100) break;
    await sleep(THROTTLE_MS);
  }
  return items;
}

async function request(url, label, attempt = 1) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "kcc-grand-prix",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const res = await fetch(url, { headers });

  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset") || 0) * 1000;
    const retryAfter = Number(res.headers.get("retry-after") || 0) * 1000;
    const wait = Math.min(
      Math.max(retryAfter, reset ? reset - Date.now() : 0, 5000),
      120000
    );
    if (attempt > 4) throw new Error(`rate limited on ${label} after ${attempt} tries`);
    console.warn(`  … rate limited (${label}), waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return request(url, label, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText} on ${label}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/* -------------------------------------------------------------- collection */

async function collectRacer(racer, cfg, scope) {
  const { since, until } = cfg.period;
  const login = racer.login;
  const events = [];

  const push = (type, item, when) => {
    if (!when) return;
    const day = isoDay(when);
    if (day < since || day > until) return;
    events.push({
      type,
      day,
      title: item.title,
      url: item.html_url,
      repo: repoFromUrl(item.repository_url) || repoFromUrl(item.url),
      number: item.number,
    });
  };

  const queries = [
    ["pr", `is:pr is:merged author:${login} merged:${since}..${until} ${scope}`],
    ["issue", `is:issue is:closed assignee:${login} closed:${since}..${until} ${scope}`],
    ["review", `is:pr -author:${login} reviewed-by:${login} updated:${since}..${until} ${scope}`],
  ];

  for (const [type, q] of queries) {
    const items = await searchIssues(q.trim(), `${login}/${type}`);
    for (const item of items) {
      push(type, item, type === "review" ? item.updated_at : item.closed_at || item.updated_at);
    }
    await sleep(THROTTLE_MS);
  }

  return events;
}

/* -------------------------------------------------------------- demo mode */

function demoEvents(racer, days, seed) {
  // Deterministic pseudo-random so the demo race looks the same every run.
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const events = [];
  const repos = ["kcc/api", "kcc/web", "kcc/infra", "kcc/mobile"];
  const verbs = ["Fix flaky test in", "Refactor", "Add retries to", "Speed up", "Document", "Harden"];
  const nouns = ["the scheduler", "the auth flow", "the cache layer", "CSV export", "the webhook", "onboarding"];
  const busy = 0.35 + rnd() * 0.9;
  for (const day of days) {
    const dow = new Date(day + "T00:00:00Z").getUTCDay();
    const weekend = dow === 0 || dow === 6;
    const n = Math.floor(rnd() * 4 * busy * (weekend ? 0.25 : 1));
    for (let i = 0; i < n; i++) {
      const roll = rnd();
      const type = roll < 0.5 ? "pr" : roll < 0.78 ? "review" : "issue";
      const num = 100 + Math.floor(rnd() * 900);
      const repo = repos[Math.floor(rnd() * repos.length)];
      events.push({
        type,
        day,
        title: `${verbs[Math.floor(rnd() * verbs.length)]} ${nouns[Math.floor(rnd() * nouns.length)]}`,
        url: `https://github.com/${repo}/pull/${num}`,
        repo,
        number: num,
      });
    }
  }
  return events;
}

/* -------------------------------------------------------------------- main */

async function main() {
  const cfg = JSON.parse(await fs.readFile(path.join(ROOT, "config.json"), "utf8"));
  if (args.since) cfg.period.since = String(args.since);
  if (args.until) cfg.period.until = String(args.until);

  const { since, until } = cfg.period;
  const days = daysBetween(since, until);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const scoring = { mergedPR: 3, issueClosed: 2, reviewSubmitted: 1, ...(cfg.scoring || {}) };
  const points = { pr: scoring.mergedPR, issue: scoring.issueClosed, review: scoring.reviewSubmitted };
  const scope = scopeQualifier(cfg.scope);

  if (!DEMO && !scope) {
    console.warn("! config.scope has no orgs or repos — the search will cover all of GitHub.");
  }
  if (!DEMO && !TOKEN) {
    console.warn("! No GITHUB_TOKEN set — unauthenticated search is limited to 10 requests/min and public repos.");
  }

  console.log(`${DEMO ? "Simulating" : "Fetching"} ${since} → ${until} for ${cfg.racers.length} racers…`);

  const racers = [];
  for (const [i, racer] of cfg.racers.entries()) {
    let events;
    if (DEMO) {
      events = demoEvents(racer, days, (i + 1) * 7919);
    } else {
      try {
        events = await collectRacer(racer, cfg, scope);
      } catch (err) {
        console.error(`  ✗ ${racer.login}: ${err.message}`);
        events = [];
      }
    }

    const daily = days.map(() => ({ pr: 0, issue: 0, review: 0, points: 0 }));
    for (const ev of events) {
      const idx = dayIndex.get(ev.day);
      if (idx === undefined) continue;
      daily[idx][ev.type] += 1;
      daily[idx].points += points[ev.type] || 0;
    }

    const totals = daily.reduce(
      (acc, d) => ({
        pr: acc.pr + d.pr,
        issue: acc.issue + d.issue,
        review: acc.review + d.review,
        points: acc.points + d.points,
      }),
      { pr: 0, issue: 0, review: 0, points: 0 }
    );

    const speed = carSpeed(racer);
    racers.push({
      login: racer.login,
      name: racer.name || racer.login,
      car: CARS[racer.car] ? racer.car : DEFAULT_CAR,
      carLabel: (CARS[racer.car] || CARS[DEFAULT_CAR]).label,
      color: paint(racer, i),
      speed,
      totals: { ...totals, distance: +(totals.points * speed).toFixed(2) },
      daily,
      events: events.sort((a, b) => (a.day < b.day ? -1 : 1)),
    });

    console.log(
      `  ${String(racer.name || racer.login).padEnd(14)} ${String(totals.pr).padStart(3)} PR  ` +
      `${String(totals.issue).padStart(3)} issues  ${String(totals.review).padStart(3)} reviews  ` +
      `→ ${totals.points} pts × ${speed} = ${(totals.points * speed).toFixed(1)}`
    );
  }

  // Lane order stays as configured — the standings panel does the ranking,
  // so the finishing order isn't given away by the grid.
  const finishing = [...racers].sort((a, b) => b.totals.distance - a.totals.distance);

  const payload = {
    generatedAt: new Date().toISOString(),
    demo: DEMO,
    title: cfg.title || "GitHub Grand Prix",
    subtitle: cfg.subtitle || "",
    period: { since, until },
    scope: cfg.scope || {},
    scoring,
    cars: CARS,
    days,
    racers,
  };

  const json = JSON.stringify(payload, null, 2);
  await fs.writeFile(path.join(ROOT, "data.json"), json + "\n");
  await fs.writeFile(
    path.join(ROOT, "data.js"),
    `// Generated by scripts/fetch.js — do not edit by hand.\nwindow.RACE_DATA = ${json};\n`
  );

  console.log(`\nWrote data.json and data.js — ${racers.length} racers, ${days.length} days.`);
  if (finishing.length) console.log(`Leader: ${finishing[0].name} (${finishing[0].totals.distance})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
