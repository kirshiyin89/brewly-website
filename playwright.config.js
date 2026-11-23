// Playwright runs the browser tests in e2e/. It starts a small static server for the
// website, so the pages load over http:// (ES modules do not load from file://).
const { defineConfig, devices } = require("@playwright/test");

// 3000 by default. Set E2E_PORT to use another port when 3000 is already taken.
const PORT = Number(process.env.E2E_PORT) || 3000;

module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // Off by default. Set SCREENSHOTS=1 to save a screenshot for every test.
    screenshot: process.env.SCREENSHOTS ? "on" : "off",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    // serve.py is a plain static server that disables browser caching.
    command: `python3 serve.py ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
  },
});
