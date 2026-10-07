# HOMEOSTASIS test publication — 2026-10-07

The current candidate is `homeostasis-89abc747ea11` (593,113 bytes; SHA-256 `4bf7dbb08f26daafe278188918a54b2b407778ada7bb5700052f3d1a25cbb201`). It is rebuilt from public source `e7e6975d83c9a2b255cac381dba6c3d19f27612e` with SFHS `fc8cbd8fc5d1dbb6bf3251d62954e8558e533619`.

Local inspect, validate, check, pack, exact verification, Samsung emulation, desktop Chromium, and the exact physical-release gate passed. The deployment repeats these checks before publishing. The physical PASS is the existing direct user report dated 2026-08-06 for these exact bytes; no new physical test is claimed. Canonical LF staging reproduces that artifact without changing gameplay. pnpm 11.9.0 matches the pinned toolchain package-manager contract.

The previous root release is retained byte-for-byte at `releases/2026-10-07-before/index.html`, along with its original release manifest. Source graduation remains on its existing branch; this release commits only delivery artifacts and verification/deployment wiring. No access policy is changed.

The following historical record is preserved for the prior release.

---

# HOMEOSTASIS GitHub Pages publication record

Date: 2026-07-24

## WHAT WAS DONE

- Published the exact SFHS-packed HOMEOSTASIS Pixi-first responsive/fullscreen artifact as root `index.html`.
- Updated release identity and provenance metadata.
- Source provenance is local canonical SFHS `main@6df0194`; the SFHS checkout has no configured public remote.

## WHAT WAS VERIFIED

- Local canonical pack and verifier passed with no findings.
- The artifact is one self-contained HTML document with no runtime external URLs.
- Automated Chromium proof passed Samsung Galaxy S21 Ultra portrait and landscape emulation plus desktop Chromium.
- The Pixi migration gate proved one visible Pixi/WebGL canvas, no visible Canvas2D world, deterministic scripted state parity, controls, resize, and exact-artifact network boundaries.
- Portrait-first layout proof showed the complete title, compact non-overlapping HUD, safe response and pause controls, and no rotate prompt.
- Fullscreen entered and exited from title and Pause button gestures while preserving the active run and recomputing viewport and hit targets.
- Public release commit `b371107f6cb799305b48c557b6ff5e1c1661b60a` was pushed to `main`.
- The live Pages document returned HTTP 200 with 592,964 bytes and SHA-256 `97207cfa05ce4ae4db61677438b344d4a0c6ac528fcaed336ba483e268d47d6d`, exactly matching canonical.

## CURRENT EXACT STATE

- Repository: `https://github.com/falloutmule/homeostasis`
- Pages source: `main` branch, repository root
- Artifact release commit: `b371107f6cb799305b48c557b6ff5e1c1661b60a`
- Canonical source: local SFHS `main@6df0194`
- Published build ID: `homeostasis-f9724aa9fefe`
- Artifact: 592,964 bytes
- Artifact SHA-256: `97207cfa05ce4ae4db61677438b344d4a0c6ac528fcaed336ba483e268d47d6d`
- Source SHA-256: `f9724aa9fefeb0f1b8a4abf0a4d225a3b17ec7ef8b85bbdf9bad258f888af83f`

## REMAINING BLOCKERS

- `BLOCKED_ON_PHYSICAL_SAMSUNG`: direct Samsung Galaxy S21 Ultra portrait and landscape acceptance has not been performed.
- Final release verdict remains `BLOCKED`; automated/emulated evidence is not a physical-device substitute.

## NEXT ACTIONABLE STEP

Run and retain direct physical Samsung Galaxy S21 Ultra acceptance evidence in
portrait and landscape before considering `RELEASE_PASS`.

Live test URL:

`https://falloutmule.github.io/homeostasis/?v=b371107`

## PASS/FAIL

**AUTOMATED_PASS / BLOCKED_ON_PHYSICAL_SAMSUNG**
