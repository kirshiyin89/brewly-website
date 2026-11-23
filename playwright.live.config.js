// Config for the LIVE suite (e2e-live/). These tests call the real ai-assistant backend,
// so they need it running, plus Groq and the database. Run them only by hand.
// The normal suite uses playwright.config.js and never picks these files up.
const { defineConfig, devices } = require("@playwright/test");

const PORT = 3000;

module.exports = defineConfig({
  testDir: "./e2e-live",
  fullyParallel: false,
  workers: 1, // one question at a time keeps the backend's rate limit predictable
  retries: 0,
  timeout: 90000, // a real model answer can take many seconds
  reporter: [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: process.env.SCREENSHOTS ? "on" : "off",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: true,
    stdout: "ignore",
  },
});
