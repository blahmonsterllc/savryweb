# Savry launch recipe catalog

## Launch gate

Savry should open public registration after the catalog contains at least 500
complete starter recipes and the invited beta community has contributed enough
activity that Explore does not feel empty. A practical target is 25–50 beta
cooks contributing 3–5 recipes each, producing roughly 575–750 recipes shortly
after launch.

The goal is useful coverage, not a large vanity count. AI-generated drafts do
not count toward the launch gate until a human has checked them.

## Recommended starter mix

| Collection | Target |
| --- | ---: |
| Dinner and mains | 140 |
| Breakfast and brunch | 50 |
| Lunches and handhelds | 45 |
| Soups and stews | 45 |
| Sides and salads | 55 |
| Baking and desserts | 75 |
| Sauces, dressings, and staples | 35 |
| Snacks and drinks | 55 |
| **Total** | **500** |

Dietary, budget, time, cuisine, equipment, and skill-level coverage should be
distributed throughout these collections rather than padded with duplicate
versions of the same dish.

## Permitted sources

1. Recipes created and tested for Savry.
2. Recipes contributed by beta cooks under Savry's publishing terms.
3. Clearly documented public-domain government material with the requested
   attribution.
4. Licensed creator collections with written permission.
5. Traditional preparations independently written and tested by Savry.

Do not copy a publisher's creative descriptions, headnotes, photographs, or
distinctive instructional wording. Social and website imports are private to
the importing user unless that user owns the recipe or has permission to
publish it.

## Required record quality

Every launch recipe needs:

- a stable title, slug, author, origin, source, and rights record;
- normalized ingredients with amount, unit, optionality, and section;
- ordered instructions with timers where appropriate;
- servings or yield plus preparation and cooking times;
- dietary tags and explicit allergen flags;
- nutrition source and match coverage rather than an unexplained estimate;
- equipment, difficulty, and category metadata;
- a rights-cleared photo or an intentional no-photo presentation;
- an editorial review covering measurements, instructions, food safety,
  allergens, nutrition provenance, and attribution;
- a content hash so duplicates can be identified before publication.

## Review states

- `draft`: incomplete and never public;
- `needs_review`: structurally complete but awaiting checks;
- `editorially_reviewed`: metadata, measurements, safety, and rights checked;
- `kitchen_tested`: cooked from the stored recipe and corrected if needed;
- `rejected`: unsafe, duplicate, improperly sourced, or otherwise unsuitable.

The initial catalog should contain at least 75 kitchen-tested hero recipes.
The remaining starter recipes must be editorially reviewed before publication.

## Candidate compilation

Run `node scripts/catalog/collect-wikibooks.mjs` to rebuild the licensed
Wikibooks review queue. The generated JSONL contains fixed source revisions,
content hashes, attribution, license requirements, parsed ingredient and
instruction text, and the 500-item collection balance above.

Collection does not equal approval. Every row remains a draft until an editor
normalizes measurements, independently reviews instructions and food safety,
adds allergen flags, checks attribution, and supplies rights-cleared media.
Because Wikibooks uses CC BY-SA, adapted recipe text must keep attribution and
the same license. Keep Savry-original recipes as a separate rights class.
