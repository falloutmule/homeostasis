import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

import { chromium } from "playwright";

import { startExactArtifactServer } from "@sfhs/browser-runner";
import { packProject } from "@sfhs/packer";

const projectRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(projectRoot, "..", "..");
const evidenceRoot = resolve(
  repositoryRoot,
  process.env.SFHS_HOMEOSTASIS_REALITY_EVIDENCE ?? ".sfhs-evidence/homeostasis-000"
);
const reportPath = join(evidenceRoot, "renderer-reality.json");
const screenshotPath = join(evidenceRoot, "renderer-reality.png");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function snapshot(page) {
  return page.evaluate(() => {
    const probe = globalThis.__SFHS_RENDER_PROBE__;
    const canvases = [...globalThis.document.querySelectorAll("#game canvas")];
    return {
      viewport: {
        width: globalThis.innerWidth,
        height: globalThis.innerHeight,
        devicePixelRatio: globalThis.devicePixelRatio
      },
      canvasCount: canvases.length,
      canvases: canvases.map((canvas, index) => {
        const rectangle = canvas.getBoundingClientRect();
        const style = globalThis.getComputedStyle(canvas);
        const centerX = Math.max(0, Math.min(globalThis.innerWidth - 1, rectangle.x + rectangle.width / 2));
        const centerY = Math.max(0, Math.min(globalThis.innerHeight - 1, rectangle.y + rectangle.height / 2));
        const hit = globalThis.document.elementFromPoint(centerX, centerY);
        const id = canvas.dataset.sfhsProbeId;
        return {
          index,
          id,
          className: canvas.className,
          backingWidth: canvas.width,
          backingHeight: canvas.height,
          rectangle: {
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height
          },
          style: {
            display: style.display,
            opacity: style.opacity,
            pointerEvents: style.pointerEvents,
            visibility: style.visibility,
            zIndex: style.zIndex
          },
          contextRequests: [...new Set(probe.contextRequests[id] ?? [])],
          activity: { ...(probe.activity[id] ?? {}) },
          hitAtCenter: hit === null ? null : {
            id: hit.id,
            className: typeof hit.className === "string" ? hit.className : "",
            tagName: hit.tagName
          },
          isLastGameChild: canvas.parentElement?.lastElementChild === canvas
        };
      }),
      animationFrame: {
        registrations: probe.animationFrame.registrations,
        callbacks: probe.animationFrame.callbacks,
        uniqueCallbacks: probe.animationFrame.uniqueCallbacks
      },
      globals: {
        cr: typeof globalThis.CR === "object",
        legacyHomeostasisTest: typeof globalThis.__HOMEOSTASIS_TEST__ === "object"
      },
      legacyRenderProbe: globalThis.__HOMEOSTASIS_TEST__?.readRenderProbe?.() ?? null
    };
  });
}

await mkdir(evidenceRoot, { recursive: true });
const packed = await packProject(projectRoot);
const bytes = Buffer.from(packed.bytes);
const server = await startExactArtifactServer(bytes);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 384, height: 854 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: "block"
});
const page = await context.newPage();
const requests = [];
const browserSignals = [];

page.on("console", (message) => {
  if (message.type() === "error") browserSignals.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => browserSignals.push(`pageerror: ${error.message}`));
await context.route("**/*", async (route) => {
  const url = route.request().url();
  requests.push(url);
  if (url === server.url || /^(?:about:blank|blob:|data:)/iu.test(url)) await route.continue();
  else await route.abort("blockedbyclient");
});

await page.addInitScript(() => {
  const probe = {
    nextCanvasId: 1,
    contextRequests: {},
    activity: {},
    animationFrame: { registrations: 0, callbacks: 0, uniqueCallbacks: 0 }
  };
  const callbackIds = new WeakSet();
  const identify = (canvas) => {
    if (canvas.dataset.sfhsProbeId === undefined) {
      canvas.dataset.sfhsProbeId = `canvas-${probe.nextCanvasId}`;
      probe.nextCanvasId += 1;
    }
    const id = canvas.dataset.sfhsProbeId;
    probe.contextRequests[id] ??= [];
    probe.activity[id] ??= { canvas2dDraws: 0, webglClears: 0, webglDraws: 0 };
    return id;
  };
  const originalGetContext = globalThis.HTMLCanvasElement.prototype.getContext;
  globalThis.HTMLCanvasElement.prototype.getContext = function getContext(type, ...arguments_) {
    const id = identify(this);
    probe.contextRequests[id].push(String(type));
    return Reflect.apply(originalGetContext, this, [type, ...arguments_]);
  };
  const wrap = (prototype, method, activityKey) => {
    const original = prototype?.[method];
    if (typeof original !== "function") return;
    prototype[method] = function instrumented(...arguments_) {
      const id = identify(this.canvas);
      probe.activity[id][activityKey] += 1;
      return Reflect.apply(original, this, arguments_);
    };
  };
  for (const method of [
    "clearRect", "drawImage", "fill", "fillRect", "fillText", "putImageData", "stroke", "strokeRect", "strokeText"
  ]) {
    wrap(globalThis.CanvasRenderingContext2D?.prototype, method, "canvas2dDraws");
  }
  for (const prototype of [globalThis.WebGLRenderingContext?.prototype, globalThis.WebGL2RenderingContext?.prototype]) {
    wrap(prototype, "clear", "webglClears");
    for (const method of ["drawArrays", "drawArraysInstanced", "drawElements", "drawElementsInstanced"]) {
      wrap(prototype, method, "webglDraws");
    }
  }
  const originalAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
  globalThis.requestAnimationFrame = (callback) => {
    probe.animationFrame.registrations += 1;
    if (!callbackIds.has(callback)) {
      callbackIds.add(callback);
      probe.animationFrame.uniqueCallbacks += 1;
    }
    return originalAnimationFrame((time) => {
      probe.animationFrame.callbacks += 1;
      return callback(time);
    });
  };
  globalThis.__SFHS_RENDER_PROBE__ = probe;
});

let beforeResize;
let afterResize;
try {
  await page.goto(server.url, { waitUntil: "load" });
  await page.locator("#fixture-start").tap();
  await page.waitForFunction(() => globalThis.CR?.getSnapshot().ticks >= 10);
  await page.waitForTimeout(300);
  beforeResize = await snapshot(page);
  await page.setViewportSize({ width: 854, height: 384 });
  await page.waitForTimeout(300);
  afterResize = await snapshot(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });
} finally {
  await context.close();
  await browser.close();
  await server.close();
}

const [mainSource, rendererSource, adapterSource, manifestSource] = await Promise.all([
  readFile(join(projectRoot, "src", "main.ts"), "utf8"),
  readFile(join(projectRoot, "src", "renderer.ts"), "utf8"),
  readFile(join(repositoryRoot, "adapters", "pixi-v8", "src", "index.ts"), "utf8"),
  readFile(join(projectRoot, "sfhs.project.json"), "utf8")
]);
const manifest = JSON.parse(manifestSource);
const visibleBefore = beforeResize.canvases.find((canvas) => canvas.className === "homeostasis-canvas");
const webglBefore = beforeResize.canvases.find((canvas) => canvas.className === "sfhs-webgl-surface");
const visibleAfter = afterResize.canvases.find((canvas) => canvas.className === "homeostasis-canvas");
const webglAfter = afterResize.canvases.find((canvas) => canvas.className === "sfhs-webgl-surface");
const emptyRenderCalls = rendererSource.match(/webGlStage\.render\(\{ circles: Object\.freeze\(\[\]\) \}\)/gu)?.length ?? 0;

const report = {
  schema: "sfhs.homeostasis-renderer-reality@1",
  artifact: {
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
    buildId: packed.descriptor.artifact.buildId,
    sourceSha256: packed.descriptor.source.sha256
  },
  classification: {
    category: "MIXED_REDUNDANT",
    primaryPresentation: "CANVAS_2D",
    secondaryPresentation: "PIXI_EMPTY_WEBGL",
    verdict: "BLOCKED_ON_ADAPTER_MISMATCH"
  },
  observations: {
    canvasCount: beforeResize.canvasCount,
    canvas2dIsLastGameChild: visibleBefore?.isLastGameChild === true,
    canvas2dDrawsDuringRuntime: (visibleAfter?.activity.canvas2dDraws ?? 0) > (visibleBefore?.activity.canvas2dDraws ?? 0),
    canvas2dResizeChangedBackingSize:
      visibleBefore?.backingWidth !== visibleAfter?.backingWidth || visibleBefore?.backingHeight !== visibleAfter?.backingHeight,
    emptyPixiRenderCallsInSource: emptyRenderCalls,
    oneObservedAnimationFrameCallbackIdentity: afterResize.animationFrame.uniqueCallbacks === 1,
    pixiGeometryDrawsDuringRuntime: (webglAfter?.activity.webglDraws ?? 0) - (webglBefore?.activity.webglDraws ?? 0),
    pixiRenderClearsDuringRuntime: (webglAfter?.activity.webglClears ?? 0) - (webglBefore?.activity.webglClears ?? 0),
    webglResizeChangedBackingSize:
      webglBefore?.backingWidth !== webglAfter?.backingWidth || webglBefore?.backingHeight !== webglAfter?.backingHeight,
    circleStageInterfaceHasResize: /interface PixiCircleStageRenderer\s*\{[^}]*\bresize\s*\(/u.test(adapterSource),
    manifestViewportMode: manifest.viewport.mode,
    sourceAndPresentedUseSamePixel:
      mainSource.includes("sourceCenter:[...pixel],presentedCenter:[...pixel]"),
    productionCRPresent: beforeResize.globals.cr,
    productionLegacyTestGlobalPresent: beforeResize.globals.legacyHomeostasisTest,
    physicalSamsungAcceptance: false
  },
  beforeResize,
  afterResize,
  requests,
  browserSignals,
  screenshot: {
    path: "renderer-reality.png",
    sha256: sha256(await readFile(screenshotPath))
  },
  verified: browserSignals.length === 0 && beforeResize.canvasCount === 2
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
