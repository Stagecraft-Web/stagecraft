/**
 * Client-side Sentry init. Loaded automatically by `@sentry/astro` and
 * injected into every page bundle, so React islands (the Appearance
 * sidebar, contact form widgets, …) and any inline page scripts get
 * instrumented without per-component setup.
 *
 * The DSN is baked in on purpose: every artist site deployed from this
 * template phones home to the same Sentry project so we can monitor
 * errors across the fleet. DSNs are public by design (Sentry treats
 * them as identifiers, not secrets), so committing it is fine.
 */
import * as Sentry from "@sentry/astro";

// DSN from Sentry → Settings → Client Keys. Public by design — every
// artist site clone reports here so we can monitor the fleet.
const SENTRY_DSN =
  "https://5b7d372bdf8537c59ab71b205c9135c7@o4511290432749568.ingest.us.sentry.io/4511290482163712";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: import.meta.env.PROD ? "production" : "development",
  // Performance — sample 10% of page loads/interactions. Bump up if
  // you need finer signal; bump down if quota becomes a concern.
  tracesSampleRate: 0.1,
  // Session replay — off by default, but record on errors so a failed
  // save in the Appearance sidebar comes with a clip showing what the
  // user did.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
