# Eval fixtures

Each fixture is a `*.json` file plus its image(s) in this folder. The harness
(`npm run eval`, with the server running) scans the images through `/api/scan`
and scores the result against your labels.

## How to add a fixture

1. Drop the photo(s) here, e.g. `haul1.jpg`, `receipt1.jpg`, `cat.jpg`.
2. Add a JSON file next to it:

```json
{
  "mode": "groceries",
  "images": ["haul1.jpg"],
  "expectedItems": [
    { "name": "Fuji Apple", "category": "produce" },
    { "name": "Whole Milk", "category": "dairy" },
    { "name": "Spinach", "category": "produce" }
  ],
  "expectedRejected": [],
  "expectedDates": { "Whole Milk": "2026-09-20" }
}
```

## Suggested coverage (~30–50 images)

- **Hauls** — mixed produce, packaged goods, fridge/pantry staples.
- **Receipts** — different stores, abbreviated line items.
- **Guardrail cases** — a person, a pet, shampoo, medicine, a wine bottle
  (expect it in `expectedRejected`, except wine which should be a flagged item).
- **Dates** — clear printed best-before dates for `expectedDates`.

Names are matched fuzzily (case/plural/qualifier-insensitive), so "apples" and
"Fuji Apple" match. Keep `expectedItems` to the items a human would clearly log.
