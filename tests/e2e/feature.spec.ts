import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import type { Page } from "@playwright/test";
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

// Draw a short stroke inside the canvas band that belongs to `stripIdx`.
// Each strip is STRIP_HEIGHT(=200)px tall; the canvas is rendered at its
// intrinsic 360x600, scaled to fit. We pick clientX/Y by reading the
// element's bounding box so the points land in the right strip band.
async function drawInStrip(page: Page, stripIdx: number) {
  const box = await page.locator(".exq-canvas").boundingBox();
  if (!box) throw new Error("no canvas");
  const bandTop = box.y + (box.height * stripIdx) / 3;
  const cx = box.x + box.width / 2;
  const y0 = bandTop + box.height / 12;
  await page.mouse.move(cx - 30, y0);
  await page.mouse.down();
  await page.mouse.move(cx - 10, y0 + 10);
  await page.mouse.move(cx + 10, y0 + 20);
  await page.mouse.move(cx + 30, y0 + 30);
  await page.mouse.up();
}

const canvasDataUrl = (page: Page) =>
  page.locator(".exq-canvas").evaluate((c) => (c as HTMLCanvasElement).toDataURL());

// THE LOAD-BEARING CROSS-PEER ASSERTION.
// Advertised: "head, body, legs hidden until reveal". This drives the real
// drawing action on peer A, proves A's strokes are NOT painted on peer B's
// canvas during the drawing phase (the "hidden" half), and proves that after
// the shared reveal flips the phase, A's strokes DO appear on peer B's canvas
// (the cross-peer composite half). Needs a 3rd peer because `reveal` is gated
// on all three strips being claimed + done; the shared BrowserContext lets us
// open a third page that syncs over the same BroadcastChannel.
test("a peer's strokes are hidden until reveal, then composite onto the other peer", async ({
  browser,
  baseURL,
}) => {
  const { context, a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  const c = await context.newPage();
  await c.goto(baseURL ?? "");
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await c.getByPlaceholder("your name").fill("carol");

    await a.locator(".exq-claim").nth(0).click(); // head
    await b.locator(".exq-claim").nth(1).click(); // body
    await c.locator(".exq-claim").nth(2).click(); // legs

    // All three occupants must be visible on every peer (claims replicate).
    await expect(b.locator(".exq-status")).toContainText("head: alice");
    await expect(b.locator(".exq-status")).toContainText("legs: carol");

    // Capture B's blank canvas, then A draws in the head strip.
    const bBefore = await canvasDataUrl(b);
    await drawInStrip(a, 0);

    // A's own canvas must now show the stroke (local render of own strip).
    await expect
      .poll(async () => (await canvasDataUrl(a)) !== bBefore, { timeout: 4000 })
      .toBe(true);

    // HIDDEN-UNTIL-REVEAL: B must NOT render A's stroke during the drawing
    // phase. B only paints its own (still-blank) strip, so B's canvas is
    // unchanged from before A drew. Give sync a beat, then assert no change.
    await b.waitForTimeout(500);
    expect(await canvasDataUrl(b)).toBe(bBefore);

    // Everyone marks done so reveal unlocks.
    await a.locator(".exq-done").click();
    await b.locator(".exq-done").click();
    await c.locator(".exq-done").click();

    // C reveals; the phase flips for every peer.
    const revealBtn = c.locator(".exq-reveal-btn");
    await expect(revealBtn).toBeEnabled();
    await revealBtn.click();
    await expect(a.locator(".exq-status")).toContainText("phase: revealed");
    await expect(b.locator(".exq-status")).toContainText("phase: revealed");

    // CROSS-PEER COMPOSITE: now B renders ALL strips, so A's head stroke must
    // appear on B's canvas — B's canvas content must differ from its blank
    // pre-reveal capture.
    await expect
      .poll(async () => (await canvasDataUrl(b)) !== bBefore, { timeout: 4000 })
      .toBe(true);
  } finally {
    await cleanup();
  }
});
