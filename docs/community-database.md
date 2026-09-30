# Savry community database

Savry uses one shared Firestore community layer. A cook's private recipe library, meal plan, grocery list, and local-model conversations stay in the app's private Core Data/iCloud store unless the cook explicitly publishes something.

## Collections

### `users/{userId}`

Community identity and account standing. Authentication is handled by Firebase Auth, exchanged for a short-lived Savry API token, and stored by the app in Keychain.

### `community_recipes/{recipeId}`

The canonical public recipe. IDs are deterministic hashes of the account and the app's private recipe ID, so retries cannot create duplicates. Each document contains:

- a structured `recipe` object with ingredients, steps, timing, yields, dietary data, allergens, equipment, nutrition, and media;
- author, source, visibility, and moderation metadata;
- `schemaVersion`, `contentHash`, exact search/prefix tokens, normalized facets, and a completeness score;
- denormalized community counters and a community ranking score;
- a monotonically increasing `version`.

### `community_recipes/{recipeId}/contributions/{contributionId}`

Made Its, comments, finished-dish photos, and structured recipe tweaks. Made Its use deterministic daily IDs. Content is screened and rate-limited before it is written.

### `community_recipes/{recipeId}/versions/{version}`

Immutable snapshots made before a republish, accepted tweak, or restore. Restoring an older snapshot creates a new version, so history is never destroyed.

### Operational collections

`rate_limits` provides serverless-safe daily limits. `moderation_queue` stores report review work. App and website APIs use the same collections and ownership rules.

## Trust model

- Clients never talk directly to Firestore. Security rules deny direct reads and writes.
- Server routes authenticate every mutation and derive ownership from the token, never from request JSON.
- Only the original author can accept a tweak or restore a prior version.
- Public Made Its require cooking proof from the app or a finished-dish photo from the web.
- Reports can hide content for review without deleting history.

## Product boundaries

Sponsors and ads are presentation data, not recipe data. They must never affect recipe rankings, accepted tweaks, or search results. Local recipe generation remains on-device; only a recipe the cook chooses to publish enters this database.
