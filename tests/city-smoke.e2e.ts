import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// Every attempt gets a fresh browser context and its own IndexedDB save slot.
test("create, save and resume a seeded city", { tags: ["smoke"] }, async ({ app, browser, screen }) => {
  await app.open("/");
  await screen.getByRole("button", /Make a new world/).tap();
  await screen.getByLabel(/WORLD SEED/).fill("e2e-smoke-city");
  await screen.getByLabel("LANDSCAPE").selectOption({ label: "Flat Plains" });
  await screen.getByRole("button", /Let's begin/).tap();

  await expect(browser.locator("#world canvas")).toBeVisible();
  await expect(browser.locator("#worldmodal")).not.toBeVisible();
  await expect(browser.locator("#pop")).toHaveText("0");
  await expect(browser.locator("#money")).toContainText("12,400");
  await screen.getByRole("button", "Settings").tap();
  await expect(screen.getByRole("dialog")).toContainText("e2e-smoke-city");
  await screen.getByLabel("RENDER QUALITY").selectOption({ label: "Balanced" });
  await expect(screen.getByLabel("RENDER QUALITY")).toHaveValue("1");
  await screen.getByRole("button", "Back to city").tap();

  await screen.getByRole("button", /House/).tap();
  const canvas = browser.locator("#world canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The city canvas has no visible bounds");
  // The fixed Flat Plains seed has buildable land at the center of this view.
  // A canvas-relative point avoids depending on the window's screen position.
  const plot = { x: bounds.width / 2, y: bounds.height / 2 };
  await canvas.tap({ position: plot });
  await expect(browser.locator("#pop")).toHaveText("4");
  await expect(browser.locator("#money")).toContainText("12,300");

  await screen.getByRole("button", /Save/).tap();
  await expect(screen.getByRole("button", "Saved ✓")).toBeVisible();
  await screen.getByRole("button", "Main menu").tap();
  await expect(screen.getByRole("button", /Make a new world/)).toBeVisible();
  // Reload proves persistence beyond the current Game instance/document.
  await browser.reload();
  await screen.getByRole("button", /Continue your city/).tap();
  await expect(browser.locator("#world canvas")).toBeVisible();
  await expect(browser.locator("#worldmodal")).not.toBeVisible();
  await expect(browser.locator("#pop")).toHaveText("4");
  await expect(browser.locator("#money")).toContainText("12,300");
  // Clearing the restored plot proves a structure, not just HUD text, survived.
  await screen.getByRole("button", /Clear/).tap();
  await browser.locator("#world canvas").tap({ position: plot });
  await expect(browser.locator("#pop")).toHaveText("0");
  await expect(browser.locator("#money")).toContainText("12,400");
  await screen.getByRole("button", "Settings").tap();
  await expect(screen.getByRole("dialog")).toContainText("e2e-smoke-city");
});
