import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("A claims head, B claims body; status reflects both occupants", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.locator(".exq-claim").nth(0).click();
    await b.locator(".exq-claim").nth(1).click();

    await expect(a.locator(".exq-status")).toContainText("head: alice");
    await expect(a.locator(".exq-status")).toContainText("body: bob");
  } finally {
    await cleanup();
  }
});
