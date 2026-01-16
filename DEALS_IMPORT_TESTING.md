# Verified Deals Import (Target + Stop & Shop test)

This repo now supports a **verified** (non-scraped, non-hallucinated) workflow for testing deal quality:

- You copy deals from Target / Stop & Shop (or export from a trusted source)
- You import them into Firestore via an **admin-only** endpoint
- You query them via an **admin-only** search endpoint
- iOS “smart” features can then use the stored deals **without GPT inventing pricing**

> Why this exists: scraping dynamic grocery sites is brittle, and “fallback sample deals” destroys trust. This path ensures *only verified data* is used.

---

## Prerequisites

1. Set admin env vars (see `ADMIN_SETUP.md`) and log in at `/admin/login`.
2. Your server must be running locally.

---

## 1) Clear existing deals for a store+ZIP (optional but recommended)

```bash
curl -X DELETE "http://localhost:3000/api/deals/clear?zipCode=11764&storeName=Target" \
  -H "Content-Type: application/json"
```

Repeat for Stop & Shop:

```bash
curl -X DELETE "http://localhost:3000/api/deals/clear?zipCode=11764&storeName=Stop%20%26%20Shop" \
  -H "Content-Type: application/json"
```

---

## 2) Import verified deals

Create a JSON payload with the exact deal values you trust.

```bash
curl -X POST "http://localhost:3000/api/deals/import" \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Target",
    "zipCode": "11764",
    "location": "Miller Place, NY",
    "sourceUrl": "https://weeklyad.target.com/",
    "validUntil": "2026-01-07T23:59:59.999Z",
    "deals": [
      {
        "itemName": "Bananas",
        "category": "Produce",
        "originalPrice": 0.69,
        "discountPrice": 0.49,
        "aisle": null,
        "section": "Produce"
      },
      {
        "itemName": "Chicken Breast (per lb)",
        "category": "Meat",
        "originalPrice": 4.99,
        "discountPrice": 3.49,
        "aisle": null,
        "section": "Meat & Seafood"
      }
    ]
  }'
```

Import Stop & Shop deals the same way:

```bash
curl -X POST "http://localhost:3000/api/deals/import" \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Stop & Shop",
    "zipCode": "11764",
    "location": "Miller Place, NY",
    "sourceUrl": "https://stopandshop.com/",
    "validUntil": "2026-01-07T23:59:59.999Z",
    "deals": [
      {
        "itemName": "Eggs (dozen)",
        "category": "Dairy",
        "originalPrice": 4.99,
        "discountPrice": 2.99,
        "aisle": null,
        "section": "Dairy"
      }
    ]
  }'
```

---

## 3) Search stored deals

All queries are based on what’s in Firestore (no scraping).

```bash
curl "http://localhost:3000/api/deals/search?zipCode=11764&storeName=Target&limit=10"
```

Search by keyword:

```bash
curl "http://localhost:3000/api/deals/search?zipCode=11764&storeName=Target&q=chicken&limit=10"
```

---

## Notes on aisle accuracy

- If you don’t have store-specific aisle mapping yet, leave `aisle: null` and keep `section`.
- Once you build/collect aisle maps per store, you can import them too.

---

## Optional: Import from a weekly-ad URL (best-effort, never guesses)

There is also an admin-only endpoint that will **fetch a URL** and attempt to import deals **only if it can extract them deterministically**:

- `POST /api/deals/import-from-url`

Example (Target weekly ad):

```bash
curl -X POST "http://localhost:3000/api/deals/import-from-url" \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Target",
    "zipCode": "11764",
    "location": "Miller Place, NY",
    "sourceUrl": "https://www.target.com/weekly-ad?promo=Target-20251228"
  }'
```

**Important:** Many major retailers (including Target) use JS-heavy pages. If the server response does not include embedded data, this endpoint will return **422** and tell you to use the verified manual import (`/api/deals/import`) instead.

Example (Stop & Shop circular):

```bash
curl -X POST "http://localhost:3000/api/deals/import-from-url" \
  -H "Content-Type: application/json" \
  -d '{
    "storeName": "Stop & Shop",
    "zipCode": "11764",
    "location": "Miller Place, NY",
    "sourceUrl": "https://circular.stopandshop.com/h/m/stopandshop/weekly/browse?flyer_run_id=1174335&locale=en-US&type=1"
  }'
```

If Stop & Shop requires location selection (ZIP prompt) and does not embed the flyer items into the HTML response, you will also get **422**. In that case, use `/api/deals/import` with verified deal values.


