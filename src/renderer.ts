import { Graphics, Sprite, Text, type Container, type Texture } from "pixi.js";
import { createSfhsPixiV8Presentation, type SfhsPixiStageLayers } from "@sfhs/adapter-pixi-v8";
import { createSfhsCompatTextureRegistry, type SfhsCompatTextureRef, type SfhsCompatTextureRegistry } from "@sfhs/pixi-canvas-compat";
import type { SfhsViewportState } from "@sfhs/pixi-runtime";
import type { readSimulationSnapshot } from "./simulation-state.ts";

export interface HomeostasisViewport { readonly width: number; readonly height: number; readonly dpr: number; }
type HomeostasisPresentationSnapshot = ReturnType<typeof readSimulationSnapshot>;
export interface HomeostasisAssets { readonly tissue: readonly (readonly HTMLCanvasElement[])[]; readonly bacteria: readonly HTMLCanvasElement[]; readonly player: HTMLCanvasElement; readonly resolve: HTMLCanvasElement; }
export interface HomeostasisPresenter {
  present(snapshot: HomeostasisPresentationSnapshot, viewport: HomeostasisViewport): void;
  resize(width: number, height: number, resolution: number): void;
  getPrimarySurface(): HTMLCanvasElement;
  getDiagnostics(): Readonly<{ readonly renderer: "PIXI"; readonly visibleCanvasCount: number; readonly meaningfulObjectCount: number; readonly destroyed: boolean; readonly textureDiagnostics: ReturnType<SfhsCompatTextureRegistry["getDiagnostics"]>; readonly webgl: Readonly<{ readonly contextLost: boolean; readonly lossStatus: string; readonly restoredCount: number; readonly contextUsable: boolean; readonly drawingBufferWidth: number; readonly drawingBufferHeight: number }> }>;
  destroy(): void;
}

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
const screen = (snapshot: HomeostasisPresentationSnapshot, viewport: HomeostasisViewport, x: number, y: number) => {
  const shake = snapshot.cameraTrauma ?? 0;
  const time = snapshot.time ?? 0;
  const camera = snapshot.camera ?? snapshot.player;
  return { x: x - camera.x + viewport.width / 2 + (shake ? Math.sin(time * 83.7) * shake : 0), y: y - camera.y + viewport.height / 2 + (shake ? Math.cos(time * 71.3) * shake : 0) };
};
function asSfhsViewport(width: number, height: number, resolution: number): SfhsViewportState {
  return Object.freeze({ logicalWidth: width, logicalHeight: height, presentedWidth: width, presentedHeight: height, backingWidth: Math.round(width * resolution), backingHeight: Math.round(height * resolution), resolution, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, orientation: width >= height ? "landscape" : "portrait" });
}

/** One SFHS-owned Pixi presentation. Generated Canvas is an attributed off-DOM asset input only. */
export async function bootHomeostasisPresenter(host: HTMLElement, assets: HomeostasisAssets, width: number, height: number, resolution: number): Promise<HomeostasisPresenter> {
  const registry = createSfhsCompatTextureRegistry();
  const refs = new Map<HTMLCanvasElement, SfhsCompatTextureRef>();
  const sprites = new Map<string, Sprite>();
  let viewport = { width, height, dpr: resolution } as HomeostasisViewport;
  let background: Graphics | undefined;
  let border: Graphics | undefined;
  let boss: Graphics | undefined;
  let bossAura: Graphics | undefined;
  let bossLabel: Text | undefined;
  let bossBar: Graphics | undefined;
  let playerHealth: Graphics | undefined;
  let storm: Graphics | undefined;
  let underflow: Graphics | undefined;
  let homeostasisGlow: Graphics | undefined;
  let debugRange: Graphics | undefined;
  let effectLayer: Container | undefined;
  let actorLayer: Container | undefined;
  const effects = new Map<string, Graphics>();
  let contextLost = false;
  let lossStatus = "";
  let restoredCount = 0;
  let destroyed = false;
  const requireValue = <Value>(value: Value | undefined, name: string): Value => { if (value === undefined) throw new Error(`HOMEOSTASIS Pixi ${name} is not initialized.`); return value; };
  const register = (source: HTMLCanvasElement, purpose: string): SfhsCompatTextureRef => {
    const existing = refs.get(source); if (existing !== undefined) return existing;
    const ref = registry.registerCanvasSource(source, { owner: "homeostasis-presentation", purpose, origin: "generated", updatePolicy: "static", expectedWidth: source.width, expectedHeight: source.height }); refs.set(source, ref); return ref;
  };
  const sprite = (key: string, texture: Texture): Sprite => {
    const existing = sprites.get(key); if (existing !== undefined) { existing.texture = texture; return existing; }
    const created = requireValue(actorLayer, "actor layer").addChild(new Sprite(texture)); created.anchor.set(.5); sprites.set(key, created); return created;
  };
  const effect = (key: string, layer: Container, draw: (graphic: Graphics) => void): Graphics => {
    const existing = effects.get(key); if (existing !== undefined) return existing;
    const created = layer.addChild(new Graphics()); draw(created); effects.set(key, created); return created;
  };
  const presentSprite = (key: string, source: HTMLCanvasElement, purpose: string, x: number, y: number, size: number, rotation = 0, alpha = 1): Sprite => { const image = sprite(key, registry.resolve(register(source, purpose))); image.position.set(x, y); image.width = size; image.height = size; image.rotation = rotation; image.alpha = alpha; image.visible = true; return image; };
  const hideSprites = (): void => { for (const image of sprites.values()) image.visible = false; };
  const hideEffects = (): void => { for (const graphic of effects.values()) graphic.visible = false; };
  const makeRect = (color: number, width: number, height: number, alpha = 1): Graphics => new Graphics().rect(0, 0, width, height).fill({ color, alpha });
  const rebuildViewportGeometry = (): void => {
    const backdrop = requireValue(background, "background"); backdrop.clear().rect(0, 0, viewport.width, viewport.height).fill(0x061315);
    const overlay = requireValue(storm, "storm"); overlay.clear().rect(0, 0, viewport.width, viewport.height).fill({ color: 0xb51c32, alpha: 1 });
    const below = requireValue(underflow, "underflow"); below.clear().rect(0, 0, viewport.width, viewport.height).fill({ color: 0x193f69, alpha: 1 });
    const stable = requireValue(homeostasisGlow, "homeostasis glow"); stable.clear().rect(0, 0, viewport.width, viewport.height).fill({ color: 0x6effd8, alpha: 1 });
  };
  const ensureLayers = (layers: SfhsPixiStageLayers): void => {
    if (background !== undefined) return;
    background = layers.backgroundLayer.addChild(new Graphics());
    border = layers.environmentLayer.addChild(new Graphics());
    for (let x = 0; x <= 1800; x += 140) border.moveTo(x, 0).lineTo(x, 1200);
    for (let y = 0; y <= 1200; y += 140) border.moveTo(0, y).lineTo(1800, y);
    border.stroke({ color: 0x76e8c6, alpha: .07, width: 1 }).rect(0, 0, 1800, 1200).stroke({ color: 0x90ffda, alpha: .18, width: 3 });
    actorLayer = layers.actorLayer;
    effectLayer = layers.worldEffectsLayer;
    bossAura = layers.worldEffectsLayer.addChild(new Graphics().circle(0, 0, 115).fill({ color: 0xffb756, alpha: .11 }).circle(0, 0, 83).fill({ color: 0xc14150, alpha: .12 }));
    boss = layers.worldEffectsLayer.addChild(new Graphics().circle(0, 0, 76).fill({ color: 0x914652, alpha: .88 }).circle(0, 0, 62).fill({ color: 0xc56750, alpha: .78 }).circle(0, 0, 49).fill({ color: 0xffa954, alpha: .62 }).circle(0, 0, 20).fill(0x2d1b31));
    bossLabel = layers.worldEffectsLayer.addChild(new Text({ text: "BIOFILM MATRIX", style: { fontFamily: "system-ui", fontSize: 11, fontWeight: "700", fill: 0xffe184, align: "center" } })); bossLabel.anchor.set(.5);
    bossBar = layers.worldEffectsLayer.addChild(makeRect(0xffbd6b, 116, 7));
    playerHealth = layers.worldEffectsLayer.addChild(makeRect(0xffffff, 38, 3, .42));
    storm = layers.screenEffectsLayer.addChild(new Graphics());
    underflow = layers.screenEffectsLayer.addChild(new Graphics());
    homeostasisGlow = layers.screenEffectsLayer.addChild(new Graphics());
    debugRange = layers.debugLayer.addChild(new Graphics().circle(0, 0, 1).stroke({ color: 0xffffff, alpha: .18, width: .008 }));
    rebuildViewportGeometry();
  };
  const presentation = createSfhsPixiV8Presentation<HomeostasisPresentationSnapshot>({
    backgroundColor: 0x061315,
    presenter: {
      present(snapshot, _alpha, layers) {
        ensureLayers(layers);
        hideSprites();
        hideEffects();
        const playerState = snapshot.player;
        if (playerState === null || playerState === undefined) return;
        const time = snapshot.time ?? 0;
        const worldEffects = requireValue(effectLayer, "world effects layer");
        const worldBorder = requireValue(border, "border");
        const topLeft = screen(snapshot, viewport, 0, 0); worldBorder.position.set(topLeft.x, topLeft.y);
        const hero = screen(snapshot, viewport, playerState.x, playerState.y);
        if (snapshot.mode === "resolve") {
          presentSprite("resolve-field", assets.resolve, "resolve-field", hero.x, hero.y, 376 * (1 + Math.sin(time * 2) * .045));
          if ((snapshot.resolvePulse ?? 0) > 0) { const pulse = effect("resolve-pulse", worldEffects, (graphic) => graphic.circle(0, 0, 1).stroke({ color: 0xc8fbff, width: .03 })); pulse.position.set(hero.x, hero.y); pulse.scale.set(40 + (1 - snapshot.resolvePulse) * 170); pulse.alpha = snapshot.resolvePulse; pulse.visible = true; }
        }
        for (const tissue of snapshot.tissues ?? []) {
          const point = screen(snapshot, viewport, tissue.x, tissue.y);
          if (point.x < -70 || point.y < -70 || point.x > viewport.width + 70 || point.y > viewport.height + 70) continue;
          const source = assets.tissue[tissue.state]?.[tissue.variant] ?? assets.tissue[tissue.state]?.[0];
          if (source !== undefined) presentSprite(`tissue:${tissue.id}`, source, `tissue:${tissue.state}:atlas`, point.x, point.y, tissue.r * 2.7, tissue.rot, tissue.state === 4 ? .65 : 1);
          if (tissue.hp > 0 && tissue.hp < 100) { const damage = effect(`tissue-health:${tissue.id}`, worldEffects, (graphic) => graphic.circle(0, 0, 1).stroke({ color: 0xffe0b4, alpha: .45, width: .05 })); damage.position.set(point.x, point.y); damage.scale.set(tissue.r + 5); damage.alpha = clamp(tissue.hp / 100, .15, .9); damage.visible = true; }
          if (tissue.repairFx > 0) { const repair = effect(`tissue-repair:${tissue.id}`, worldEffects, (graphic) => graphic.circle(0, 0, 1).stroke({ color: 0x75efff, width: .075 })); repair.position.set(point.x, point.y); repair.scale.set(tissue.r + 9 + Math.sin(time * 9) * 2); repair.alpha = Math.min(1, tissue.repairFx * 5); repair.visible = true; }
        }
        for (const bacterium of snapshot.bacteria ?? []) {
          const point = screen(snapshot, viewport, bacterium.x, bacterium.y);
          if (point.x < -40 || point.y < -40 || point.x > viewport.width + 40 || point.y > viewport.height + 40) continue;
          const source = assets.bacteria[bacterium.variant] ?? assets.bacteria[0];
          if (source !== undefined) presentSprite(`bacteria:${bacterium.id}`, source, "bacteria:atlas", point.x, point.y, bacterium.r * 3.2, bacterium.rot);
          if (bacterium.marked > 0) { const marked = effect(`bacteria-marked:${bacterium.id}`, worldEffects, (graphic) => graphic.circle(0, 0, 1).stroke({ color: 0x68ffd3, alpha: .8, width: .07 })); marked.position.set(point.x, point.y); marked.scale.set(bacterium.r + 7 + Math.sin(time * 8) * 2); marked.visible = true; }
        }
        for (const [index, pickup] of (snapshot.pickups ?? []).entries()) { const point = screen(snapshot, viewport, pickup.x, pickup.y); const orb = effect(`pickup:${index}`, worldEffects, (graphic) => graphic.circle(0, 0, 1).fill(0xd8ff8e).circle(0, 0, 1).stroke({ color: 0xffffdc, alpha: .8, width: .22 })); orb.position.set(point.x, point.y); orb.scale.set(5 + Math.sin(time * 6 + pickup.x) * 1.5); orb.visible = true; }
        for (const [index, antibody] of (snapshot.antibodies ?? []).entries()) { const point = screen(snapshot, viewport, antibody.x, antibody.y); const shape = effect(`antibody:${index}`, worldEffects, (graphic) => graphic.moveTo(0, 7).lineTo(0, 0).lineTo(-6, -7).moveTo(0, 0).lineTo(6, -7).stroke({ color: 0xb7e7ff, width: 2, cap: "round" })); shape.position.set(point.x, point.y); shape.rotation = antibody.rot; shape.scale.set(.8); shape.visible = true; }
        for (const [index, neutrophil] of (snapshot.neutrophils ?? []).entries()) { const point = screen(snapshot, viewport, neutrophil.x, neutrophil.y); const cell = effect(`neutrophil:${index}`, worldEffects, (graphic) => graphic.circle(0, 0, 10).fill(0xd9e8d2).ellipse(-4, 0, 3, 4).fill(0x65757d).ellipse(0, 1.7, 3, 4).fill(0x65757d).ellipse(4, -1.7, 3, 4).fill(0x65757d)); cell.position.set(point.x, point.y); cell.tint = neutrophil.flash > 0 ? 0xfff7c5 : 0xffffff; cell.visible = true; }
        const bossState = snapshot.boss;
        const bossShape = requireValue(boss, "boss"); const aura = requireValue(bossAura, "boss aura"); const label = requireValue(bossLabel, "boss label"); const bossHealth = requireValue(bossBar, "boss bar");
        if (bossState !== null && bossState !== undefined && !bossState.dead) {
          const point = screen(snapshot, viewport, bossState.x, bossState.y); const pulse = 1 + Math.sin(time * 2.4) * .04; aura.position.set(point.x, point.y); aura.scale.set(pulse); aura.visible = true; bossShape.position.set(point.x, point.y); bossShape.scale.set(pulse); bossShape.visible = true;
          const fraction = bossState.matrixHp > 0 ? bossState.matrixHp / bossState.matrixMax : bossState.coreHp / bossState.coreMax;
          label.text = bossState.matrixHp > 0 ? "BIOFILM MATRIX" : "NIDUS CORE"; label.position.set(point.x, point.y - 93); label.visible = true; bossHealth.tint = bossState.matrixHp > 0 ? 0xffbd6b : 0xff6074; bossHealth.position.set(point.x - 58, point.y + 82); bossHealth.scale.x = clamp(fraction, 0, 1); bossHealth.visible = true;
        } else { aura.visible = false; bossShape.visible = false; label.visible = false; bossHealth.visible = false; }
        const heroShape = presentSprite("player", assets.player, "player", hero.x, hero.y, playerState.r * 3.2, 0, 1);
        heroShape.tint = snapshot.mode === "resolve" ? 0x9edff0 : 0xffffff;
        const health = requireValue(playerHealth, "player health"); health.position.set(hero.x - 19, hero.y + playerState.r + 8); health.scale.x = clamp(playerState.hp / playerState.maxHp, 0, 1);
        if (playerState.attackFx > 0 && playerState.attackTarget !== null && playerState.attackTarget !== undefined && !playerState.attackTarget.dead) { const target = screen(snapshot, viewport, playerState.attackTarget.x, playerState.attackTarget.y); const dx = target.x - hero.x; const dy = target.y - hero.y; const beam = effect("player-attack", worldEffects, (graphic) => graphic.moveTo(.08, 0).lineTo(.82, 0).stroke({ color: 0xdaffbd, alpha: .82, width: 5, cap: "round" })); beam.position.set(hero.x, hero.y); beam.rotation = Math.atan2(dy, dx); beam.scale.set(Math.hypot(dx, dy), 1); beam.alpha = playerState.attackFx; beam.visible = true; }
        for (const [index, particle] of (snapshot.particles ?? []).entries()) { if (!particle.active) continue; const point = screen(snapshot, viewport, particle.x, particle.y); const alpha = clamp(particle.ttl / particle.max, 0, 1); const mote = effect(`particle:${index}`, worldEffects, (graphic) => particle.kind === "ring" ? graphic.circle(0, 0, 1).stroke({ color: 0xffffff, width: .02 }) : graphic.circle(0, 0, 1).fill(0xffffff)); mote.tint = Number.parseInt(String(particle.color).replace("#", ""), 16); mote.position.set(point.x, point.y); mote.scale.set(particle.kind === "ring" ? particle.r * (2 - alpha) * 3 : particle.r * alpha); mote.alpha = alpha; mote.visible = true; }
        const overlay = requireValue(storm, "storm"); const below = requireValue(underflow, "underflow"); const stable = requireValue(homeostasisGlow, "homeostasis glow"); const over = Math.max(0, snapshot.inflammation - snapshot.safeHigh); const under = Math.max(0, snapshot.safeLow - snapshot.inflammation); overlay.alpha = clamp(over * .75 * (snapshot.mode === "resolve" ? .12 : 1), 0, .42); below.alpha = over > 0 ? 0 : clamp(under * .32, 0, .13); stable.alpha = bossState?.dead && snapshot.resolveHold > 0 ? .03 + .04 * Math.sin(time * 4) : 0;
        const range = requireValue(debugRange, "debug range"); range.position.set(hero.x, hero.y); range.scale.set(135 + (snapshot.upgrades.phagocyticReach ?? 0) * 28); range.visible = snapshot.debug === true;
      }
    }
  });
  await presentation.mount(host);
  const surface = presentation.getPrimarySurface();
  surface.className = "sfhs-webgl-surface"; surface.setAttribute("data-sfhs-presentation", "pixi");
  surface.addEventListener("webglcontextlost", (event) => { contextLost = true; lossStatus = (event as WebGLContextEvent).statusMessage; event.preventDefault(); });
  surface.addEventListener("webglcontextrestored", () => { contextLost = false; restoredCount += 1; });
  presentation.resize(asSfhsViewport(width, height, resolution));
  return {
    present(snapshot, nextViewport) { if (destroyed) throw new Error("Destroyed HOMEOSTASIS Pixi presenter cannot present."); viewport = nextViewport; presentation.present(snapshot, 0); },
    resize(nextWidth, nextHeight, nextResolution) { if (destroyed) throw new Error("Destroyed HOMEOSTASIS Pixi presenter cannot resize."); viewport = { width: nextWidth, height: nextHeight, dpr: nextResolution }; presentation.resize(asSfhsViewport(nextWidth, nextHeight, nextResolution)); if (background !== undefined) rebuildViewportGeometry(); },
    getPrimarySurface: () => presentation.getPrimarySurface(),
    getDiagnostics: () => { const gl = surface.getContext("webgl2") ?? surface.getContext("webgl"); return Object.freeze({ renderer: "PIXI" as const, visibleCanvasCount: host.querySelectorAll("canvas").length, meaningfulObjectCount: presentation.getDiagnostics().stage.meaningfulObjectCount, destroyed, textureDiagnostics: registry.getDiagnostics(), webgl: Object.freeze({ contextLost, lossStatus, restoredCount, contextUsable: gl !== null && !gl.isContextLost(), drawingBufferWidth: gl?.drawingBufferWidth ?? 0, drawingBufferHeight: gl?.drawingBufferHeight ?? 0 }) }); },
    destroy() { if (destroyed) return; registry.destroy(); refs.clear(); sprites.clear(); presentation.destroy(); destroyed = true; }
  };
}
