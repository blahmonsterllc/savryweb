# Savry launch catalog review queue

`wikibooks-candidates.jsonl` contains 500 **draft candidates**, not 500
publishable recipes. The candidates were compiled from fixed revisions of the
Wikibooks Cookbook. Each row preserves its source revision, content hash,
attribution statement, and license.

## License notice

The adapted Wikibooks recipe text in `wikibooks-candidates.jsonl` is available
under the [Creative Commons Attribution-ShareAlike 4.0 International
License](https://creativecommons.org/licenses/by-sa/4.0/). Each row identifies
the particular source revision and provides an attribution statement. The
Wikibooks contributors listed in each linked page history are the original
contributors. Savry does not claim exclusive rights in this source text.

This notice applies to the adapted Wikibooks material, not to unrelated Savry
source code, trademarks, original recipes, user content, or media. No source
photographs were collected.

## Current status

- 500 licensed candidates are present.
- 0 are approved for publication.
- 0 have completed allergen and food-safety review.
- 0 have rights-cleared photos.
- 0 have been inserted into the public `recipes` table.

Run `npm run catalog:check` for a local integrity check. The importer requires
an explicit `--commit --project-ref <ref>` and a server-side Supabase secret,
preventing an accidental upload to an unrelated project.

An editor must normalize each ingredient into name, amount, and unit; verify
servings and timings; rewrite unclear wording; classify allergens and dietary
claims; check food temperatures and handling; confirm attribution; and choose
an original or separately licensed image. Only then may the candidate move to
`editorially_reviewed` or `kitchen_tested`.
