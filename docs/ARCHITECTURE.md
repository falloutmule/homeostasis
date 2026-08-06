# Architecture

## Ownership and runtime

`src/index.html` is the DOM shell, `src/main.ts` owns input, overlays, fixed-step scheduling, audio, and renderer integration, and the `simulation-*` modules hold rules, state, and tests. `src/renderer.ts` presents immutable simulation snapshots through the SFHS Pixi/WebGL adapter. The runtime flow is input → semantic actions → 60 Hz simulation → rendering; rendering does not save or mutate simulation state.

`public/` contains project-owned static inputs. Source assets are procedural; generated visual/audio data is created locally at runtime. Local settings are optional and isolated to the documented localStorage key.

## Build and artifact path

The game is an external consumer of pinned SFHS, not a copy of SFHS core. `one-shot/SFHS-PIN.json` pins the toolchain. In a matching SFHS workspace, the packer reads `sfhs.project.json` and emits `dist/index.html`; pack embeds the build descriptor/source identity and forbids external runtime references and dynamic chunks.

CI checks out the pinned SFHS revision, stages this Git revision at `examples/homeostasis`, runs the SFHS command sequence, and browser-proves the exact packed file. The Pages workflow repeats that sequence, verifies `releases/manifests/release-gate.json`, then uploads only the verified `dist/index.html` plus `.nojekyll` as the Pages artifact. It has least permissions and deployment concurrency.

The root `index.html` is an earlier self-contained Pages artifact, retained temporarily as a legacy deployment fallback. It is neither the editable source nor the current candidate output.
