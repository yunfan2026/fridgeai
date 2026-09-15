# AppPlan

Before editing code, Cowork/Codex should summarize the app purpose, required layout, colors, inputs, outputs, system prompt requirements, and model behavior from this plan. Treat the app idea and design ideas below as requirements for the first working version.

## App idea

- **Use case:** Help home cooks track what's in their fridge, freezer, and pantry — and reduce food waste by suggesting recipes that use ingredients expiring soonest. Users upload a photo of their grocery haul, the app identifies items and estimates expiry dates, and the inventory is maintained across three locations. A recipe nudge surfaces what to cook before things go bad.

- **Intended user:** Anyone who cooks at home and wants to reduce food waste and money on groceries and simplify meal planning. No technical knowledge required.

- **User input:**
  1. Photo of a grocery haul (uploaded or taken with camera) → computer vision identifies items and reads expiry dates from packaging via OCR.
  2. Manual location assignment (Fridge / Freezer / Pantry) after reviewing the detected item list — user can correct or delete wrong detections before saving.
  3. Item removal via a "−" button in the Inventory view: tapping "−" prompts a one-tap reason — Consumed or Threw it away — then removes the item.

- **Model output:**
  1. Detected item list from the grocery photo (name, quantity guess, detected expiry date or estimated shelf life).
  2. Expiry date extracted from packaging via OCR. If no date is found, assign a common shelf-life estimate by food type (e.g., fresh spinach = 5 days, eggs = 21 days, frozen chicken = 90 days). Show a "Stored 7+ days — check before using" alert as a secondary fallback when a stored item has no reliable date.
  3. Recipe suggestions from the LLM: a short list of 2–3 practical recipes that prioritise the ingredients with the nearest expiry dates, with a one-line reason per recipe (e.g., "Uses your spinach and feta expiring tomorrow").

- **System prompt requirements:** The LLM acts as a friendly kitchen assistant. It receives the current inventory as a JSON list of items with names, locations, and days-until-expiry. It should return exactly 2–3 recipe suggestions, each with: recipe name, a one-sentence reason tied to the expiring ingredients, and a short 3–5 step method. It must prioritise items expiring within 3 days. It must not invent perishable ingredients the user doesn't have (fresh produce, dairy, meat, fish). It may assume common dry pantry staples are always available (salt, pepper, cooking oil, vinegar, basic spices, sugar, flour, butter) unless the user's inventory clearly contradicts this. Output should be plain, concise, and free of marketing language. Format as structured JSON so the front end can render it cleanly.

- **Approach:**
  - Computer vision: Google Vision API (`OBJECT_LOCALIZATION` + `TEXT_DETECTION`) for item identification and OCR for expiry dates.
  - LLM: Gemini Flash API (`gemini-2.5-flash`) for recipe suggestions.
  - Fallback: if no expiry date is detected by OCR, assign a default shelf-life estimate based on food category. If the item category is unknown, flag it with a "stored 7+ days" alert after 7 days.

- **Important source material or dataset:** No external dataset required. Use a pre-loaded synthetic inventory (10–15 items across fridge/freezer/pantry with realistic expiry dates) as demo data so recipe suggestions and waste tracking work reliably during demo regardless of CV accuracy.

## Product notes

- **App name:** FridgeAI (working title)
- **Tone and style:** Friendly but efficient. Conversational where needed (recipe nudges, removal prompts), data-forward everywhere else (inventory list, expiry dates, waste stats). No fluff.

## Design ideas

Treat these design choices as requirements, not loose suggestions.

- **Colors:** Warm off-white background (`#fff8f3`) for the shell; vibrant orange (`#f4622a`) as the primary accent for buttons, tab indicators, and highlights; white card surfaces (`#ffffff`) for inventory items and recipe cards; deep brown (`#2d1a0e`) for primary text and the bottom tab bar; amber (`#ffb300`) for warning states (items expiring within 2–3 days); red (`#e53935`) for overdue items. Avoid cool grays and pastels — keep the palette warm throughout.

- **Fonts:** System sans-serif stack (Arial, Helvetica, sans-serif) for body and UI labels; slightly larger bold weight for item names on cards. Keep it clean and legible at small sizes — this is a mobile-first app.

- **Layout:** Single-page app with a **fixed bottom tab bar** with three tabs: 📷 Scan, 🗂 Inventory, 🍳 Recipes. Each tab shows its own view without a full page reload. On desktop the bottom bar becomes a centred navigation strip and the content area is capped at 480px width to simulate a phone viewport.

- **Visual tone:** Bold and modern — card-based, high contrast, strong use of the green accent color. Each inventory item is a compact card with item name, location badge, and a colored expiry chip (green → amber → red as expiry approaches). The Scan view is full-width with a prominent upload zone. The Recipes view shows recipe cards with the expiring-ingredient callout highlighted.

## App structure

The app has three views, switchable via the bottom tab bar:

1. **Scan** — Large upload/camera zone. After upload, shows a loading state while Vision API processes the image. Displays detected items as an editable checklist (name, quantity, detected expiry or estimated shelf life). Each row has a location dropdown (Fridge / Freezer / Pantry). A "Save to Inventory" button commits all items.

2. **Inventory** — All saved items grouped by location (Fridge, Freezer, Pantry). Within each group, items are sorted by expiry date, soonest first. Each item card shows: item name, expiry chip (days remaining, color-coded), quantity, and a "−" button. Tapping "−" shows an inline two-button prompt: Consumed / Threw it away. Confirming updates the waste log and removes the item. A summary bar at the top shows: "X items expiring within 3 days" and the weekly waste stat.

3. **Recipes** — Calls the LLM with the current inventory on load. Shows 2–3 recipe cards. Each card: recipe name, one-line reason ("Uses your spinach expiring tomorrow"), collapsible 3–5 step method. A "Refresh suggestions" button re-calls the LLM.

## Removal flow

Inventory → tap "−" on item → inline prompt appears: [Consumed] [Threw it away] → one tap → item removed, waste log updated.

## Waste tracking

Log each removal with item name, reason (Consumed / Threw it away), and timestamp. Surface in the Inventory view header as a simple weekly stat: "You've consumed X items and thrown away Y items this week." Store in browser localStorage for V1.

## Out of scope for V1

- Barcode scanning
- Push notifications
- Multi-user household sharing
- Nutritional tracking
- Backend database (localStorage only for V1)

## Demo strategy

Pre-load a synthetic inventory of 12–15 items across all three locations with realistic expiry dates spanning the next 0–14 days. This ensures recipe suggestions and the expiry alert system work immediately on demo without depending on CV accuracy.

## Notes to Cowork/Codex

The app uses React or plain JavaScript with Express on the backend. Keep the Google Vision API call server-side (never expose API keys in the browser). The Gemini recipe call should also be server-side. Create a clearly labeled, easily editable `SYSTEM_PROMPT` constant at the top of the relevant server file. The front end is a single HTML + JS + CSS file served from `/public`. Keep it deployable on Railway with `npm start`. Do not add a database — use `localStorage` for inventory and waste log persistence in V1.
