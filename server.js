import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'local.env') });

const app = express();
const port = process.env.PORT || 3000;
const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.use(express.json({ limit: '25mb' }));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// ─── PROMPTS — edit freely ───────────────────────────────────────────────────

// Scan: identify groceries OR parse a receipt, apply guardrails, estimate shelf life.
const SCAN_PROMPT = `You are the vision engine for FridgeAI, a kitchen inventory app.

You receive one or more images from a SINGLE shopping trip. Depending on MODE:
- MODE "groceries": photos of grocery items / packaging. Identify every distinct edible item.
  Multiple images may show the SAME items from different angles or a printed date on packaging —
  merge them into ONE deduplicated list, do not double-count.
- MODE "receipt": a store receipt. Extract each purchased food line item. Expand abbreviations to
  real names (e.g. "GG APPL FUJI" -> "Fuji Apple", "WHL MLK" -> "Whole Milk"). Use the printed
  quantity. Receipts carry no expiry dates.

GUARDRAILS — be strict:
- REJECT anything that is not food/drink for people: people, pets, furniture, phones, utensils,
  and non-food consumables (medicine/pharmaceuticals, cleaning supplies, cosmetics, toiletries,
  paper goods). Put a short label for each rejected thing in "rejected".
- ALLOW dietary/nutritional supplements you consume (protein powder, creatine, vitamins,
  electrolyte mixes, collagen) as trackable items with category "supplement".
- ALLOW pet food as a normal trackable item (category "petfood").
- ALLOW alcohol and tobacco, but add "alcohol" or "tobacco" to that item's "flags" and set its
  shelfLifeDays to null (no expiry nudging).
- If an image contains no valid items, return an empty "items" array.

For each accepted item provide:
- name: specific, human-readable (prefer "Fuji Apple" over "Apple" when identifiable)
- category: one of produce, dairy, meat, seafood, bakery, pantry, frozen, beverage, supplement, petfood, other
- quantity: number (default 1; use the receipt/pack count when visible)
- unit: natural unit (pieces, bag, bottle, block, container, cans, loaf, ...)
- trackingType: "count" for discrete countable units (eggs, apples, cans); "portion" for bulk/
  packaged things consumed gradually (milk, bag of spinach, block of cheese, rice)
- suggestedLocation: Fridge, Freezer, or Pantry
- shelfLifeDays: typical days this stays good from purchase (your best estimate), or null if flagged
- expiresAt: a printed/best-before date if you can read one on packaging, as YYYY-MM-DD, else null
- expirySource: "printed" if expiresAt came from the image, else "estimate"
- flags: array (usually empty)
- confidence: 0..1, your certainty in the identification

Return ONLY valid minified JSON of the form:
{"items":[{...}],"rejected":["person","shampoo"]}`;

// Capture-date: read a single printed expiry/best-before date.
const DATE_PROMPT = `You are reading a printed date off food packaging. Find the expiry, use-by, best-
before, or sell-by date in the image. Return ONLY JSON: {"expiresAt":"YYYY-MM-DD"} using the most
likely expiry date, or {"expiresAt":null} if no date is legible. Resolve 2-digit years to 20xx and
ambiguous formats to the nearest plausible future date.`;

// Recipes: unchanged behavior from v1 — friendly kitchen assistant.
const RECIPE_PROMPT = `You are a friendly kitchen assistant for FridgeAI.

You receive the user's current food inventory as a JSON array. Each item has: name, location,
daysLeft (days until expiry; negative = expired), quantity.

Suggest 2-3 practical recipes following these rules:
1. Prioritise ingredients with daysLeft <= 3 — use them before they go bad
2. Do NOT invent perishable ingredients (fresh produce, dairy, meat, fish) not in the inventory
3. You MAY assume pantry staples are always available: salt, pepper, cooking oil, vinegar, basic
   spices, sugar, flour, butter, garlic, onion
4. Recipes must be realistic and cookable with what is listed
5. For every ingredient give a specific quantity (e.g. "2 tbsp olive oil", "3 cloves garlic")
6. Output ONLY a valid JSON array — no markdown fences

Return exactly:
[{"name":"Recipe Name","reason":"One sentence on which expiring ingredient(s) this uses","ingredients":["2 chicken breasts","2 cups spinach"],"steps":["Step 1","Step 2","Step 3"]}]`;

// ── Helpers ──────────────────────────────────────────────────────────────────

// Belt-and-suspenders alcohol detection (mirrors web/src/lib/alcohol.js) so items
// are flagged even if the model misses it; flagged items get no expiry nudging.
const ALCOHOL_RE =
  /\b(wine|beer|soju|sake|vodka|whisky|whiskey|tequila|rum|gin|brandy|cognac|liqueur|champagne|prosecco|ale|lager|stout|bourbon|sangria|vermouth|baijiu|makgeolli|cocktail|seltzer|chamisul|cabernet|sauvignon|merlot|chardonnay|ipa)\b/i;

function tagAlcohol(item) {
  if (!ALCOHOL_RE.test(item?.name || '')) return item;
  const flags = Array.isArray(item.flags) ? item.flags : [];
  return {
    ...item,
    flags: flags.includes('alcohol') ? flags : [...flags, 'alcohol'],
    shelfLifeDays: null,
    expiresAt: null,
    expirySource: 'estimate',
  };
}

// Detect image type from the first bytes so HEIC/PNG/WebP (not just JPEG) work.
function detectMime(b64) {
  const buf = Buffer.from(b64.slice(0, 64), 'base64');
  const hex = buf.toString('hex');
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.slice(8, 12).toString('ascii').toLowerCase();
    if (/hei|mif1|msf1|hevc/.test(brand)) return 'image/heic';
  }
  return 'image/jpeg';
}

function imagePart(b64) {
  return { inlineData: { mimeType: detectMime(b64), data: b64 } };
}

function parseJSON(text) {
  const cleaned = String(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, geminiModel, hasGeminiKey: Boolean(ai) });
});

// ── Scan — Gemini multimodal (groceries or receipt) ───────────────────────────
app.post('/api/scan', async (req, res) => {
  const { images = [], mode = 'groceries' } = req.body || {};
  if (!ai) return res.status(400).json({ error: 'Missing GEMINI_API_KEY on the server.' });
  if (!images.length) return res.status(400).json({ error: 'No images provided.' });

  try {
    const parts = [
      { text: `MODE "${mode === 'receipt' ? 'receipt' : 'groceries'}".` },
      ...images.map(imagePart),
    ];
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [{ role: 'user', parts }],
      config: { systemInstruction: SCAN_PROMPT, responseMimeType: 'application/json' },
    });

    const data = parseJSON(response.text);
    const items = (Array.isArray(data.items) ? data.items : []).map(tagAlcohol);
    const rejected = Array.isArray(data.rejected) ? data.rejected : [];
    res.json({ items, rejected });
  } catch (err) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Capture date — Gemini OCR of one printed date ─────────────────────────────
app.post('/api/capture-date', async (req, res) => {
  const { image } = req.body || {};
  if (!ai) return res.status(400).json({ error: 'Missing GEMINI_API_KEY on the server.' });
  if (!image) return res.status(400).json({ error: 'No image provided.' });

  try {
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [{ role: 'user', parts: [{ text: 'Read the date.' }, imagePart(image)] }],
      config: { systemInstruction: DATE_PROMPT, responseMimeType: 'application/json' },
    });
    const data = parseJSON(response.text);
    res.json({ expiresAt: data.expiresAt || null });
  } catch (err) {
    console.error('Capture-date error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Recipes — Gemini ──────────────────────────────────────────────────────────
app.post('/api/recipes', async (req, res) => {
  if (!ai) return res.status(400).json({ error: 'Missing GEMINI_API_KEY on the server.' });
  const { inventory = [] } = req.body || {};
  if (!inventory.length) return res.status(400).json({ error: 'Inventory is empty.' });

  try {
    const userMessage = `Here is my current food inventory:\n${JSON.stringify(
      inventory,
      null,
      2
    )}\n\nSuggest 2-3 recipes.`;
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      config: { systemInstruction: RECIPE_PROMPT, responseMimeType: 'application/json' },
    });
    res.json({ recipes: parseJSON(response.text) });
  } catch (err) {
    console.error('Recipe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Serve the built React app (production) ────────────────────────────────────
const distDir = path.join(__dirname, 'web', 'dist');
app.use(express.static(distDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Run `npm run build` to build the web app.');
  });
});

app.listen(port, () => {
  console.log(`FridgeAI running on http://localhost:${port}`);
});
