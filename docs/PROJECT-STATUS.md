# Project status

Status date: 2026-08-06. Status claims distinguish automated Chromium emulation from a physical device.

| Area | Status | Evidence or limitation |
| --- | --- | --- |
| Editable source authority | VERIFIED | `one-shot/SOURCE-LINEAGE.json` selects `source-1-adaf755f8887`; original source remained read-only. |
| Playable survival loop, scenes, controls, upgrades, results | IMPLEMENTED | Imported behavior and targeted unit/browser proofs. |
| Pixi/WebGL required presentation | VERIFIED | Current browser proof shows one meaningful visible Pixi/WebGL surface and no visible Canvas2D world. |
| Exact packed artifact | VERIFIED | `homeostasis-89abc747ea11`, 593,113 bytes, SHA-256 `4bf7dbb08f26daafe278188918a54b2b407778ada7bb5700052f3d1a25cbb201`. |
| Samsung Galaxy S21 Ultra Android Chrome emulation | VERIFIED | Portrait and landscape automated proof passed with no findings. |
| Desktop Chromium | VERIFIED | Automated exact-artifact proof passed with no findings. |
| Physical Samsung Galaxy S21 Ultra acceptance | BLOCKED | No direct stable Android Chrome execution/acceptance record exists. Emulation is not a substitute. |
| GitHub Pages current live artifact | VERIFIED / SUPERSEDED | Existing Pages serves `homeostasis-f9724aa9fefe`, SHA-256 `97207cfa05ce4ae4db61677438b344d4a0c6ac528fcaed336ba483e268d47d6d`; it is the retained previous release. |
| Action-based Pages deployment of current candidate | BLOCKED | Must not replace legacy Pages until exact physical acceptance is reported and the release gate passes. |
| Reuse license | BLOCKED | The supplied package has no reuse license; `RIGHTS.md` deliberately grants none. |

The new current artifact is locally canonical for SFHS pack/verify and browser evidence, but is not a published release candidate because physical acceptance remains blocked. Known tooling limitation: the SFHS graduation materializer at the pinned commit does not locate Playwright in the browser-runner workspace path and rejects duplicate workspace package metadata; the documented disposable workspace overlay was used for verification, without modifying SFHS core.
