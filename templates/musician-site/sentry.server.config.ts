/**
 * Server-side Sentry init. Loaded automatically by `@sentry/astro`
 * and applied to Astro/Netlify SSR endpoints — the appearance-save
 * route, the contact form's Resend call, Keystatic's GitHub
 * round-trips, and any prerender errors during `astro build`.
 *
 * The DSN matches `sentry.client.config.ts`; both halves report into
 * the same project so we can correlate a server error with the
 * client session that triggered it.
 */
import * as Sentry from "@sentry/astro";

// Keep this in sync with `sentry.client.config.ts`.
const SENTRY_DSN =
  "https://d0d07275287cfed946b7a2de38d3f04e@o4511290432749568.ingest.us.sentry.io/4511290484195328";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: import.meta.env.PROD ? "production" : "development",
  tracesSampleRate: 0.1,
});
