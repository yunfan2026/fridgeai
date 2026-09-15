#!/usr/bin/env node
// ============================================================================
// FridgeAI recognition eval harness.
//
// Runs every labeled fixture in eval/fixtures/*.json through the live /api/scan
// endpoint and reports item precision/recall/F1, guardrail accuracy, and
// date-extraction accuracy.
//
// Usage:
//   1. Start the server:  npm start   (needs GEMINI_API_KEY in local.env)
//   2. In another shell:  npm run eval
//
// A fixture is a JSON file like:
//   {
//     "mode": "groceries",
//     "images": ["haul1.jpg"],                 // files sit next to the JSON
//     "expectedItems": [{ "name": "Fuji Apple", "category": "produce" }],
//     "expectedRejected": ["person", "shampoo"],
//     "expectedDates": { "Milk": "2026-09-20" }
//   }
// ============================================================================

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');
const RESULTS = path.join(__dirname, 'results');
const SERVER = process.env.EVAL_SERVER || 'http://localhost:3000';

// ── Fuzzy name matching ──────────────────────────────────────────────────────
const normalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(fresh|organic|whole|large|small)\b/g, '')
    .replace(/s\b/g, '')
    .trim();

const tokens = (s) => new Set(normalize(s).split(/\s+/).filter(Boolean));

// Two names match if one contains the other, or they share a meaningful token.
function namesMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  for (const t of ta) if (t.length > 2 && tb.has(t)) return true;
  return false;
}

// Greedy 1:1 match of predicted names to expected names.
function matchItems(expected, predicted) {
  const usedPred = new Set();
  let tp = 0;
  const missed = [];
  for (const exp of expected) {
    const idx = predicted.findIndex((p, i) => !usedPred.has(i) && namesMatch(exp.name, p.name));
    if (idx >= 0) {
      usedPred.add(idx);
      tp += 1;
    } else {
      missed.push(exp.name);
    }
  }
  const phantom = predicted.filter((_, i) => !usedPred.has(i)).map((p) => p.name);
  return { tp, missed, phantom };
}

// ── Metric accumulation ──────────────────────────────────────────────────────
function pctF(num, den) {
  return den === 0 ? 1 : num / den;
}

async function runFixture(file) {
  const gt = JSON.parse(readFileSync(file, 'utf8'));
  const dir = path.dirname(file);
  const images = (gt.images || [])
    .map((name) => path.join(dir, name))
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p).toString('base64'));

  if (!images.length) {
    return { name: path.basename(file), skipped: 'no image files found' };
  }

  const res = await fetch(`${SERVER}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, mode: gt.mode || 'groceries' }),
  });
  const data = await res.json();
  if (!res.ok) return { name: path.basename(file), error: data.error || res.status };

  const predItems = data.items || [];
  const predRejected = data.rejected || [];

  // Item P/R/F1
  const { tp, missed, phantom } = matchItems(gt.expectedItems || [], predItems);
  const precision = pctF(tp, predItems.length);
  const recall = pctF(tp, (gt.expectedItems || []).length);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  // Guardrail: how many expected rejections were caught; did any real food get rejected?
  const expRej = gt.expectedRejected || [];
  const caughtRej = expRej.filter((r) => predRejected.some((p) => namesMatch(r, p))).length;
  const guardrailRecall = pctF(caughtRej, expRej.length);
  const falseRejected = (gt.expectedItems || []).filter((it) =>
    predRejected.some((p) => namesMatch(it.name, p))
  ).length;

  // Date extraction
  const expDates = gt.expectedDates || {};
  const dateKeys = Object.keys(expDates);
  let dateHits = 0;
  for (const k of dateKeys) {
    const match = predItems.find((p) => namesMatch(k, p.name));
    if (match && match.expiresAt === expDates[k]) dateHits += 1;
  }
  const dateAcc = pctF(dateHits, dateKeys.length);

  return {
    name: path.basename(file),
    precision,
    recall,
    f1,
    guardrailRecall,
    falseRejected,
    dateAcc,
    missed,
    phantom,
    detail: { tp, predicted: predItems.length, expected: (gt.expectedItems || []).length },
  };
}

function fmt(x) {
  return `${(x * 100).toFixed(0)}%`;
}

async function main() {
  if (!existsSync(FIXTURES)) {
    console.error(`No fixtures dir at ${FIXTURES}`);
    process.exit(1);
  }
  const files = readdirSync(FIXTURES)
    .filter((f) => f.endsWith('.json') && f !== 'README.json')
    .map((f) => path.join(FIXTURES, f));

  if (!files.length) {
    console.log('No fixtures found. Add labeled images + JSON to eval/fixtures/. See fixtures/README.md');
    return;
  }

  const rows = [];
  for (const file of files) {
    process.stdout.write(`Scanning ${path.basename(file)}… `);
    try {
      const r = await runFixture(file);
      rows.push(r);
      console.log(r.skipped ? `skipped (${r.skipped})` : r.error ? `error (${r.error})` : 'done');
    } catch (e) {
      console.log(`error (${e.message})`);
      rows.push({ name: path.basename(file), error: e.message });
    }
  }

  const scored = rows.filter((r) => r.f1 !== undefined);
  console.log('\n─── Per-fixture ─────────────────────────────────────────────');
  console.log('fixture'.padEnd(24), 'P'.padStart(5), 'R'.padStart(6), 'F1'.padStart(6), 'guard'.padStart(7), 'date'.padStart(6));
  for (const r of scored) {
    console.log(
      r.name.padEnd(24),
      fmt(r.precision).padStart(5),
      fmt(r.recall).padStart(6),
      fmt(r.f1).padStart(6),
      fmt(r.guardrailRecall).padStart(7),
      fmt(r.dateAcc).padStart(6)
    );
  }

  if (scored.length) {
    const avg = (k) => scored.reduce((s, r) => s + r[k], 0) / scored.length;
    const falseRej = scored.reduce((s, r) => s + r.falseRejected, 0);
    console.log('─── Overall ─────────────────────────────────────────────────');
    console.log(`  Item precision : ${fmt(avg('precision'))}`);
    console.log(`  Item recall    : ${fmt(avg('recall'))}`);
    console.log(`  Item F1        : ${fmt(avg('f1'))}`);
    console.log(`  Guardrail recall: ${fmt(avg('guardrailRecall'))}  (real food wrongly rejected: ${falseRej})`);
    console.log(`  Date accuracy  : ${fmt(avg('dateAcc'))}`);

    if (!existsSync(RESULTS)) mkdirSync(RESULTS);
    const out = path.join(RESULTS, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString(), rows: scored }, null, 2));
    console.log(`\nSaved ${out}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
