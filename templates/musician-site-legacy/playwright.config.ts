import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  webServer: {
    command: "npm run preview",
    port: 4321,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:4321",
  },
});
