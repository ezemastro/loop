/**
 * A real build always has this set (`.env`, `eas.json`, or the CI environment); jest never loads
 * `.env`, so it is the one place this suite mirrors what a configured build guarantees. Without it,
 * `config.ts`'s required-env guard (client-build-hardening: Required Configuration Fails Loudly)
 * would fail every suite that imports `config.ts`, directly or transitively.
 */
process.env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
