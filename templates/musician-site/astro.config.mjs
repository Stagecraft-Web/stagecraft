// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import markdoc from "@astrojs/markdoc";
import netlify from "@astrojs/netlify";

export default defineConfig({
  adapter: netlify(),
  integrations: [react(), markdoc()],
  image: {
    domains: [],
  },
  vite: {
    optimizeDeps: {
      include: ["react-dom/client"],
    },
  },
});
