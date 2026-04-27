// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import markdoc from "@astrojs/markdoc";
import netlify from "@astrojs/netlify";
import sentry from "@sentry/astro";

// Sentry runtime options (DSN, sampleRate, environment, …) live in
// `sentry.client.config.ts` / `sentry.server.config.ts` at the project
// root. The integration here only carries source-map upload options,
// which are build-time and need credentials in CI env vars.
//
// Required for source-map upload (set in Netlify → Site settings → Env):
//   SENTRY_AUTH_TOKEN  — org auth token, treat as secret
//   SENTRY_ORG         — your Sentry org slug
//   SENTRY_PROJECT     — your Sentry project slug
//
// Without these, the build still succeeds; source maps just won't be
// uploaded, so production stack traces stay minified.
export default defineConfig({
  adapter: netlify(),
  integrations: [
    sentry({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Disable telemetry — keeps build logs quiet for artist clones.
      telemetry: false,
    }),
    react(),
    markdoc(),
  ],
  image: {
    domains: [],
  },
  vite: {
    optimizeDeps: {
      include: ["react-dom/client"],
    },
  },
});
