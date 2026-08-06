import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

import { chromium } from "playwright";

import {
  runExactArtifactBrowserSmoke,
  startExactArtifactServer
} from "@sfhs/browser-runner";
import { packProject } from "@sfhs/packer";

const projectRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(projectRoot, "..", "..");
const evidenceRoot = resolve(
  repositoryRoot,
  process.env.SFHS_HOMEOSTASIS_EVIDENCE ?? ".sfhs-evidence/homeostasis-import"
);
const artifactPath = join(projectRoot, "dist", "index.html");
const profiles = Object.freeze([
  Object.freeze({
    id: "samsung-s21-ultra-portrait-emulation",
    width: 384,
    height: 854,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  }),
  Object.freeze({
    id: "samsung-s21-ultra-landscape-emulation",
    width: 854,
    height: 384,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  }),
  Object.freeze({
    id: "desktop-chromium",
    width: 1440,
    height: 900,
    deviceScaleFactor: 1
  })
]);
const chromiumWebglArgs = Object.freeze(["--use-angle=swiftshader"]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function collectBrowserSignals(page, records) {
  let active = true;
  page.on("console", (message) => {
    const knownWarning = /GL Driver Message.*GPU stall due to ReadPixels|^WebGL: (?:CONTEXT_LOST_WEBGL: loseContext: context lost|INVALID_OPERATION: loseContext: context already lost)$/iu.test(message.text());
    if (active && (message.type() === "error" || (message.type() === "warning" && !knownWarning))) {
      records.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    if (active) records.push(`pageerror: ${error.message}`);
  });
  return () => {
    active = false;
  };
}

async function routeExactArtifact(context, url, requests, findings) {
  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    requests.push(requestUrl);
    if (requestUrl === url || /^(?:about:blank|blob:|data:)/iu.test(requestUrl)) {
      await route.continue();
    } else {
      findings.push(`unexpected request: ${requestUrl}`);
      await route.abort("blockedbyclient");
    }
  });
}

async function runSamsungInteraction(bytes) {
  const server = await startExactArtifactServer(bytes);
  const browser = await chromium.launch({ headless: true, args: chromiumWebglArgs });
  const context = await browser.newContext({
    viewport: { width: 384, height: 854 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block"
  });
  const page = await context.newPage();
  const requests = [];
  const findings = [];
  const browserSignals = [];
  const stopSignals = collectBrowserSignals(page, browserSignals);
  await routeExactArtifact(context, server.url, requests, findings);
  await page.addInitScript(() => {
    const prototype = globalThis.HTMLCanvasElement.prototype;
    const original = prototype.getContext;
    const records = [];
    Object.defineProperty(globalThis, "__SFHS_CONTEXT_AUDIT__", { value: Object.freeze({ snapshot: () => records.map((record) => ({ connected: record.canvas.isConnected, width: record.canvas.getBoundingClientRect().width, height: record.canvas.getBoundingClientRect().height, contexts: [...record.contexts].sort() })) }) });
    prototype.getContext = function (...args) {
      let record = records.find((candidate) => candidate.canvas === this);
      if (record === undefined) { record = { canvas: this, contexts: new Set() }; records.push(record); }
      record.contexts.add(String(args[0]));
      return original.apply(this, args);
    };
  });

  let checks;
  let titleEvidence;
  let fullscreenEvidence;
  let layoutEvidence;
  let hitTargetEvidence;
  let resultEvidence;
  let renderEvidence;
  try {
    await page.goto(server.url, { waitUntil: "load" });
    titleEvidence = await page.evaluate(() => {
      const title = globalThis.document.querySelector("#titleOverlay h1");
      const panel = globalThis.document.querySelector("#titleOverlay .panel");
      const rect = title.getBoundingClientRect(); const panelRect = panel.getBoundingClientRect();
      return { text: title.textContent, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, panel: { x: panelRect.x, y: panelRect.y, width: panelRect.width, height: panelRect.height }, scrollWidth: title.scrollWidth, clientWidth: title.clientWidth, layout: globalThis.document.querySelector("#fixture-shell").dataset.layout, desktopHelpDisplay: globalThis.getComputedStyle(globalThis.document.querySelector(".desktopHelp")).display, rotatePromptPresent: /rotate|landscape required/iu.test(globalThis.document.body.innerText) };
    });
    await page.screenshot({ path: join(evidenceRoot, "samsung-portrait-title.png"), fullPage: true });
    const fullscreenSupported = await page.evaluate(() => globalThis.document.fullscreenEnabled);
    const titleRevisionBefore = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState().viewportRevision);
    let titleEntered = false; let titleExited = false; let titleRevisionAfter = titleRevisionBefore;
    if (fullscreenSupported) {
      await page.locator("#titleFullscreenBtn").tap();
      await page.waitForFunction(() => globalThis.document.fullscreenElement !== null);
      titleEntered = true;
      await page.locator("#titleFullscreenBtn").tap();
      await page.waitForFunction(() => globalThis.document.fullscreenElement === null);
      titleExited = true;
      titleRevisionAfter = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState().viewportRevision);
    }
    await page.locator("#fixture-start").tap();
    await page.waitForFunction(() => globalThis.CR?.getSnapshot().ticks >= 5);

    const initial = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    await page.screenshot({ path: join(evidenceRoot, "samsung-portrait-gameplay.png"), fullPage: true });
    renderEvidence = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readRenderProbe());
    const contextEvidence = await page.evaluate(() => globalThis.__SFHS_CONTEXT_AUDIT__.snapshot());
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 70, y: 500, id: 1 }]
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 150, y: 500, id: 1 }]
    });
    await page.waitForTimeout(220);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const afterMove = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());

    const engageStorm = await page.evaluate(() => {
      const test = globalThis.__HOMEOSTASIS_TEST__;
      test.damageTissue();
      test.setInflammation(0.99);
      test.stepFrames(30);
      return test.readState();
    });
    await page.screenshot({ path: join(evidenceRoot, "samsung-portrait-storm.png"), fullPage: true });
    await page.locator("#stanceBtn").tap();
    const resolveImmediate = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    const resolveLater = await page.evaluate(() => {
      globalThis.__HOMEOSTASIS_TEST__.stepFrames(180);
      return globalThis.__HOMEOSTASIS_TEST__.readState();
    });
    const layout = await page.evaluate(() => {
      const rect = (selector) => {
        const value = globalThis.document.querySelector(selector).getBoundingClientRect();
        return { x: value.x, y: value.y, width: value.width, height: value.height };
      };
      const overlaps = (left, right) => !(
        left.x + left.width <= right.x || right.x + right.width <= left.x ||
        left.y + left.height <= right.y || right.y + right.height <= left.y
      );
      const pause = rect("#pauseBtn");
      const pathogen = rect("#hud .hudBox:nth-child(3)");
      const stance = rect("#stanceBtn");
      const hudBoxes = [...globalThis.document.querySelectorAll("#hud .hudBox")].map((element) => { const value = element.getBoundingClientRect(); return { x: value.x, y: value.y, width: value.width, height: value.height }; });
      return {
        pause,
        pathogen,
        stance,
        pausePathogenOverlap: overlaps(pause, pathogen),
        pauseHudOverlap: hudBoxes.some((box) => overlaps(pause, box)),
        stanceHudOverlap: hudBoxes.some((box) => overlaps(stance, box)),
        stanceInsideViewport: stance.x >= 0 && stance.y >= 0 &&
          stance.x + stance.width <= globalThis.innerWidth &&
          stance.y + stance.height <= globalThis.innerHeight
      };
    });
    layoutEvidence = layout;
    const hitEvidence = await page.evaluate(() => {
      const targetAtCenter = (selector) => { const rect = globalThis.document.querySelector(selector).getBoundingClientRect(); return globalThis.document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest("button")?.id ?? null; };
      return { stance: targetAtCenter("#stanceBtn"), pause: targetAtCenter("#pauseBtn") };
    });
    hitTargetEvidence = hitEvidence;
    const rotationBefore = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    await page.setViewportSize({ width: 854, height: 384 });
    await page.waitForTimeout(80);
    const landscapeResize = await page.evaluate(() => {
      const probe = globalThis.__HOMEOSTASIS_TEST__.readRenderProbe();
      const stance = globalThis.document.querySelector("#stanceBtn").getBoundingClientRect();
      const pause = globalThis.document.querySelector("#pauseBtn").getBoundingClientRect();
      const buttonAt = (rect) => globalThis.document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest("button")?.id ?? null;
      return { canvas: probe.visibleCanvas?.rect, oneCanvas: probe.visibleCanvasCount === 1, usable: probe.webgl?.contextUsable === true, stanceInside: stance.x >= 0 && stance.y >= 0 && stance.x + stance.width <= globalThis.innerWidth && stance.y + stance.height <= globalThis.innerHeight, stanceTarget: buttonAt(stance), pauseTarget: buttonAt(pause), layout: globalThis.document.querySelector("#fixture-shell").dataset.layout, state: globalThis.__HOMEOSTASIS_TEST__.readState() };
    });
    await page.setViewportSize({ width: 384, height: 854 });
    await page.waitForTimeout(80);
    const portraitReturn = await page.evaluate(() => {
      const stance = globalThis.document.querySelector("#stanceBtn").getBoundingClientRect(); const pause = globalThis.document.querySelector("#pauseBtn").getBoundingClientRect();
      const buttonAt = (rect) => globalThis.document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest("button")?.id ?? null;
      return { stanceTarget: buttonAt(stance), pauseTarget: buttonAt(pause), layout: globalThis.document.querySelector("#fixture-shell").dataset.layout };
    });
    await page.screenshot({ path: join(evidenceRoot, "samsung-portrait-resolve.png"), fullPage: true });

    await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.focusBoss());
    await page.waitForTimeout(50);
    await page.screenshot({ path: join(evidenceRoot, "samsung-portrait-boss.png"), fullPage: true });

    await page.locator("#pauseBtn").tap();
    const pauseBeforeFullscreen = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    let pauseEntered = false; let pauseExited = false; let pauseAfterFullscreen = pauseBeforeFullscreen;
    if (fullscreenSupported) {
      await page.locator("#pauseFullscreenBtn").tap(); await page.waitForFunction(() => globalThis.document.fullscreenElement !== null); pauseEntered = true;
      await page.locator("#pauseFullscreenBtn").tap(); await page.waitForFunction(() => globalThis.document.fullscreenElement === null); pauseExited = true;
      pauseAfterFullscreen = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    }
    fullscreenEvidence = { supported: fullscreenSupported, titleEntered, titleExited, titleRevisionBefore, titleRevisionAfter, pauseEntered, pauseExited, pauseBefore: pauseBeforeFullscreen, pauseAfter: pauseAfterFullscreen };
    await page.locator("#pauseMuteBtn").tap();
    const storedSettings = await page.evaluate(() => JSON.parse(globalThis.localStorage.getItem("homeostasis.settings.v1")));
    await page.locator("#resumeBtn").tap();
    await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.grantXp(999));
    const upgradeVisible = await page.locator("#upgradeOverlay").isVisible();
    await page.screenshot({ path: join(evidenceRoot, "samsung-portrait-upgrade.png"), fullPage: true });
    await page.locator("#declineBtn").tap();
    await page.evaluate(() => {
      globalThis.__HOMEOSTASIS_TEST__.forceVictoryWindow();
      globalThis.__HOMEOSTASIS_TEST__.stepFrames(12);
    });
    const resultState = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    resultEvidence = Object.freeze({ scene: resultState.scene, result: resultState.result });
    await page.screenshot({ path: join(evidenceRoot, "samsung-portrait-result.png"), fullPage: true });
    await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.forceFailure());
    const failureVisible = await page.locator("#resultOverlay").isVisible();
    await page.screenshot({ path: join(evidenceRoot, "samsung-portrait-failure.png"), fullPage: true });

    checks = Object.freeze({
      boot: initial.scene === "play" && initial.buildId === "HOMEOSTASIS-VS-006-RESPONSIVE-FULLSCREEN",
      portraitTitleComplete: titleEvidence.text === "HOMEOSTASIS" && titleEvidence.scrollWidth <= titleEvidence.clientWidth && titleEvidence.rect.x >= titleEvidence.panel.x && titleEvidence.rect.x + titleEvidence.rect.width <= titleEvidence.panel.x + titleEvidence.panel.width,
      portraitPreferred: titleEvidence.layout === "portrait" && titleEvidence.desktopHelpDisplay === "none" && titleEvidence.rotatePromptPresent === false,
      requiredWebglSurface: renderEvidence.webglSurface === true,
      exactlyOneVisiblePixiCanvas: renderEvidence.visibleCanvasCount === 1,
      meaningfulPixiStage: renderEvidence.meaningfulObjectCount > 0,
      liveWebglContext: renderEvidence.webgl?.contextUsable === true && renderEvidence.webgl?.contextLost === false && renderEvidence.destroyed === false,
      noVisibleCanvas2d: contextEvidence.filter((canvas) => canvas.connected && canvas.width > 0 && canvas.height > 0).every((canvas) => !canvas.contexts.includes("2d")),
      touchDragMovement: afterMove.player.x > initial.player.x,
      engageProducedShake: engageStorm.cameraShake > 0,
      touchStanceEnteredResolve: resolveImmediate.mode === "resolve",
      resolveStoppedShakeImmediately: resolveImmediate.cameraShake === 0,
      resolveLoweredInflammation: resolveLater.inflammation < resolveImmediate.inflammation,
      resolveRepairFeedback: resolveLater.repairingTissues > 0,
      pauseClearLayout: layout.pausePathogenOverlap === false && layout.pauseHudOverlap === false && layout.stanceHudOverlap === false,
      stanceInsideViewport: layout.stanceInsideViewport,
      hitTargets: hitEvidence.stance === "stanceBtn" && hitEvidence.pause === "pauseBtn",
      landscapeResize: landscapeResize.oneCanvas && landscapeResize.usable && landscapeResize.stanceInside && landscapeResize.canvas?.width === 854 && landscapeResize.canvas?.height === 384 && landscapeResize.layout === "wide",
      rotationPreservedRun: landscapeResize.state.seed === rotationBefore.seed && landscapeResize.state.scene === rotationBefore.scene && landscapeResize.state.ticks >= rotationBefore.ticks,
      touchTargetsAfterResize: landscapeResize.stanceTarget === "stanceBtn" && landscapeResize.pauseTarget === "pauseBtn" && portraitReturn.stanceTarget === "stanceBtn" && portraitReturn.pauseTarget === "pauseBtn" && portraitReturn.layout === "portrait",
      fullscreenEnterExit: !fullscreenSupported || (titleEntered && titleExited && pauseEntered && pauseExited),
      fullscreenRecomputedViewport: !fullscreenSupported || (titleRevisionAfter > titleRevisionBefore && pauseAfterFullscreen.viewportRevision > pauseBeforeFullscreen.viewportRevision),
      fullscreenPreservedRun: !fullscreenSupported || (pauseAfterFullscreen.seed === pauseBeforeFullscreen.seed && pauseAfterFullscreen.scene === "pause" && pauseAfterFullscreen.ticks === pauseBeforeFullscreen.ticks && pauseAfterFullscreen.player.x === pauseBeforeFullscreen.player.x && pauseAfterFullscreen.player.y === pauseBeforeFullscreen.player.y),
      optionalStorageRoundTrip: storedSettings?.version === 1 && typeof storedSettings.muted === "boolean",
      upgradeScene: upgradeVisible,
      resultScene: resultState.scene === "result" && resultState.result?.won === true,
      failureScene: failureVisible,
      oneDocumentRequest: requests.length === 1,
      noBrowserSignals: browserSignals.length === 0,
      noFindings: findings.length === 0
    });
  } catch (error) {
    findings.push(error instanceof Error ? error.message : "unknown Samsung interaction failure");
    checks = Object.freeze({ completed: false });
  } finally {
    stopSignals();
    await page.close();
    await context.close();
    await browser.close();
    await server.close();
  }

  return Object.freeze({
    profile: profiles[0].id,
    checks,
    layout: layoutEvidence,
    title: titleEvidence,
    fullscreen: fullscreenEvidence,
    hitTargets: hitTargetEvidence,
    result: resultEvidence,
    render: renderEvidence,
    requests: Object.freeze(requests),
    browserSignals: Object.freeze(browserSignals),
    findings: Object.freeze(findings),
    valid: Object.values(checks).every(Boolean) && findings.length === 0
  });
}

async function runDesktopInteraction(bytes) {
  const server = await startExactArtifactServer(bytes);
  const browser = await chromium.launch({ headless: true, args: chromiumWebglArgs });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block"
  });
  const page = await context.newPage();
  const requests = [];
  const findings = [];
  const browserSignals = [];
  const stopSignals = collectBrowserSignals(page, browserSignals);
  await routeExactArtifact(context, server.url, requests, findings);

  let checks;
  try {
    await page.goto(server.url, { waitUntil: "load" });
    await page.locator("#fixture-start").click();
    await page.waitForFunction(() => globalThis.CR?.getSnapshot().ticks >= 5);
    const initial = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(180);
    await page.keyboard.up("KeyD");
    const moved = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    await page.keyboard.press("Space");
    const resolved = await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState());
    await page.keyboard.press("Escape");
    const pauseVisible = await page.locator("#pauseOverlay").isVisible();
    await page.locator("#resumeBtn").click();
    await page.keyboard.press("F3");
    const debugVisible = await page.locator("#debugText").isVisible();
    await page.screenshot({ path: join(evidenceRoot, "desktop-running.png"), fullPage: true });
    checks = Object.freeze({
      keyboardMovement: moved.player.x > initial.player.x,
      keyboardResolve: resolved.mode === "resolve",
      keyboardPause: pauseVisible,
      resume: (await page.evaluate(() => globalThis.__HOMEOSTASIS_TEST__.readState().scene)) === "play",
      debugOverlay: debugVisible,
      oneDocumentRequest: requests.length === 1,
      noBrowserSignals: browserSignals.length === 0,
      noFindings: findings.length === 0
    });
  } catch (error) {
    findings.push(error instanceof Error ? error.message : "unknown desktop interaction failure");
    checks = Object.freeze({ completed: false });
  } finally {
    stopSignals();
    await page.close();
    await context.close();
    await browser.close();
    await server.close();
  }

  return Object.freeze({
    profile: profiles[2].id,
    checks,
    requests: Object.freeze(requests),
    browserSignals: Object.freeze(browserSignals),
    findings: Object.freeze(findings),
    valid: Object.values(checks).every(Boolean) && findings.length === 0
  });
}

async function runDeterministicBrowserParity(bytes) {
  const server = await startExactArtifactServer(bytes);
  const browser = await chromium.launch({ headless: true, args: chromiumWebglArgs });
  const capture = async () => {
    const context = await browser.newContext({ viewport: { width: 384, height: 854 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.addInitScript(() => { globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => undefined; });
    await page.goto(server.url, { waitUntil: "load" });
    await page.waitForFunction(() => globalThis.__HOMEOSTASIS_TEST__ !== undefined && globalThis.document.querySelector(".sfhs-webgl-surface") !== null);
    const snapshot = await page.evaluate(() => {
      const test = globalThis.__HOMEOSTASIS_TEST__;
      test.start("SFHS-013B2-DETERMINISTIC");
      test.spawnBacteria(3);
      test.stepFrames(90);
      test.toggleMode();
      test.stepFrames(120);
      return test.readSimulationState();
    });
    await page.close(); await context.close(); return snapshot;
  };
  try { const first = await capture(); const second = await capture(); return Object.freeze({ seed: "SFHS-013B2-DETERMINISTIC", equal: JSON.stringify(first) === JSON.stringify(second), first, second }); }
  finally { await browser.close(); await server.close(); }
}

await mkdir(evidenceRoot, { recursive: true });
const existingBytes = new Uint8Array(await readFile(artifactPath));
const packed = await packProject(projectRoot);
const exactArtifactStable = sha256(existingBytes) === sha256(packed.bytes);

const profileReports = [];
for (const profile of profiles) {
  profileReports.push(await runExactArtifactBrowserSmoke(packed.bytes, packed.descriptor, {
    viewport: profile,
    browserLaunchArgs: chromiumWebglArgs,
    screenshotPath: join(evidenceRoot, `${profile.id}.png`)
  }));
}

const samsung = await runSamsungInteraction(packed.bytes);
const desktop = await runDesktopInteraction(packed.bytes);
const deterministic = await runDeterministicBrowserParity(packed.bytes);
const report = Object.freeze({
  schema: "sfhs.homeostasis-import-browser-proof@1",
  automation: Object.freeze({
    browser: "headless Chromium",
    webglBackend: "SwiftShader via --use-angle=swiftshader",
    physicalDeviceSubstitute: false
  }),
  targetOrder: Object.freeze([
    "Samsung Galaxy S21 Ultra Android Chrome emulation",
    "desktop Chromium"
  ]),
  physicalSamsungAcceptance: false,
  artifact: Object.freeze({
    path: "examples/homeostasis/dist/index.html",
    bytes: packed.bytes.byteLength,
    sha256: sha256(packed.bytes),
    buildId: packed.descriptor.artifact.buildId,
    sourceSha256: packed.descriptor.source.sha256,
    stableAgainstPretestArtifact: exactArtifactStable
  }),
  profiles: Object.freeze(profileReports.map((entry) => Object.freeze({
    id: entry.browser.profile.id,
    valid: entry.valid,
    phase: entry.runtime.phase,
    selfCheckPass: entry.runtime.selfCheckPass,
    requestCount: entry.requests.length,
    findings: entry.findings
  }))),
  samsung,
  desktop,
  deterministic,
  valid: exactArtifactStable && profileReports.every((entry) => entry.valid) && samsung.valid && desktop.valid && deterministic.equal
});

await writeFile(join(evidenceRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.valid) process.exitCode = 1;
