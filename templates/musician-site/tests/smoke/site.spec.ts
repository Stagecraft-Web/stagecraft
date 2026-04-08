import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Artist Name/);
  await expect(page.locator("h1")).toBeVisible();
});

test("navigation links are present", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator("nav[aria-label='Main navigation']");
  await expect(nav).toBeVisible();
  await expect(nav.locator("a")).toHaveCount(6);
});

test("about page loads", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator("h1")).toContainText("About");
});

test("music page loads with releases", async ({ page }) => {
  await page.goto("/music");
  await expect(page.locator("h1")).toContainText("Music");
});

test("photos page loads", async ({ page }) => {
  await page.goto("/photos");
  await expect(page.locator("h1")).toContainText("Photos");
});

test("press page loads", async ({ page }) => {
  await page.goto("/press");
  await expect(page.locator("h1")).toContainText("Press");
});

test("contact page loads with form", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.locator("h1")).toContainText("Contact");
  await expect(page.locator("form.contact-form")).toBeVisible();
  await expect(page.locator("input#name")).toBeVisible();
  await expect(page.locator("input#email")).toBeVisible();
  await expect(page.locator("textarea#message")).toBeVisible();
  await expect(page.locator("button[type='submit']")).toBeVisible();
});

test("contact form has honeypot field hidden", async ({ page }) => {
  await page.goto("/contact");
  const honeypot = page.locator(".hp-field");
  await expect(honeypot).toHaveAttribute("aria-hidden", "true");
});
