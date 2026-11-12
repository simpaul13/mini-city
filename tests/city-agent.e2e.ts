import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("create and restore a city through natural-language interactions", { tags: ["ai"] }, async ({ app, agent, browser, screen }) => {
  await app.open("/");
  await agent.act("Open the form for making a new world.");
  await expect(screen.getByRole("heading", "Choose your landscape.")).toBeVisible();
  await agent.act("Set the world seed to {seed}.", { params: { seed: "e2e-agent-city" } });
  await expect(screen.getByLabel(/WORLD SEED/)).toHaveValue("e2e-agent-city");
  await agent.act("Choose the {landscape} landscape. Leave water coverage unchanged.", { params: { landscape: "Flat Plains" } });
  await expect(screen.getByLabel("LANDSCAPE")).toHaveValue("Flat Plains");
  await agent.act("Begin the city using the current landscape settings.");
  await expect(browser.locator("#world canvas")).toBeVisible();
  await expect(browser.locator("#worldmodal")).not.toBeVisible();

  await agent.act("Open the city's settings.");
  await expect(screen.getByRole("dialog")).toContainText("e2e-agent-city");
  await agent.act('Set render quality to "Balanced".');
  await expect(screen.getByLabel("RENDER QUALITY")).toHaveValue("1");
  await agent.act("Return from settings to the city.");
  await expect(screen.getByRole("dialog")).not.toBeVisible();
  await agent.act("Save this city.");
  await expect(screen.getByRole("button", "Saved ✓")).toBeVisible();
  await agent.act("Return to the main menu.");
  await expect(screen.getByRole("button", /Make a new world/)).toBeVisible();
  await browser.reload();
  await agent.act("Continue the previously saved city, without making a new world.");
  await expect(browser.locator("#world canvas")).toBeVisible();
  await expect(browser.locator("#worldmodal")).not.toBeVisible();
  await agent.act("Open the city's settings.");
  await expect(screen.getByRole("dialog")).toContainText("e2e-agent-city");
  await expect(browser.locator("#pop")).toHaveText("0");
  await expect(browser.locator("#money")).toContainText("12,400");
});
