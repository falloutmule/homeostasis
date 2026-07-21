# HOMEOSTASIS GitHub Pages release proof

Date: 2026-07-21

## WHAT WAS DONE

- Created the public `falloutmule/homeostasis` GitHub repository.
- Published the previously verified SFHS artifact unchanged as root
  `index.html`.
- Added provenance, release hashes, source/release policy, and the required
  SFHS and PixiJS MIT notices without adding a license grant for HOMEOSTASIS.
- Enabled HTTPS GitHub Pages from `main` at `/` with `.nojekyll`.

## WHAT WAS VERIFIED

- GitHub Pages build completed successfully for the release commit.
- The live URL returned HTTP 200 with `text/html; charset=utf-8`.
- The downloaded live file was 542,777 bytes and had SHA-256
  `e8f94463a2851c322c395541cb47d7518ddce32e0870c77ab8c3dd889fb5e469`,
  exactly matching the SFHS-verified local artifact.
- Live Chromium ran in this order: Samsung Galaxy S21 Ultra portrait
  emulation, Samsung Galaxy S21 Ultra landscape emulation, desktop Chromium.
- Every profile reached the running lifecycle phase, passed
  `window.CR.runFullSelfCheck()`, created both required render surfaces, made
  exactly one document request, and emitted no retained browser signal.
- Samsung portrait additionally passed touch-drag movement and touch
  Engage/Resolve switching. Desktop passed keyboard movement and Space
  Engage/Resolve switching.
- Human screenshot review confirmed the visible world, HUD, pause button,
  stance control, and Resolve feedback at all three target sizes.

## WHAT FAILED

The first live desktop proof attempt used the touch-only Playwright `tap()` API
in a non-touch desktop context. Samsung had already passed. The proof harness
was corrected to use `click()` for desktop and the complete ordered live proof
then passed. No site code or release artifact changed.

## CURRENT EXACT STATE

- Repository: `https://github.com/falloutmule/homeostasis`
- Pages source: `main` branch, repository root
- Published build ID: `homeostasis-40d9487cfae1`
- Published artifact SHA-256:
  `e8f94463a2851c322c395541cb47d7518ddce32e0870c77ab8c3dd889fb5e469`
- Runtime external request allowlist remains empty.
- The required bundled PixiJS adapter contains third-party `new Function`
  renderer feature detection/code generation; authored HOMEOSTASIS code does
  not. This is disclosed in `SOURCE_RELEASE_POLICY.md`.

## REMAINING BLOCKERS

- Automated Samsung results are device emulation and are not a physical-device
  feel or performance verdict.
- HOMEOSTASIS has no third-party reuse license. Public availability is not
  permission to copy, modify, or redistribute it.

## NEXT ACTIONABLE STEP

No further action is required for this release. A future artifact replacement
must repeat the SFHS and exact live-artifact checks in
`SOURCE_RELEASE_POLICY.md`.

## EVIDENCE

- `RELEASE.json`
- `SOURCE_RELEASE_POLICY.md`
- `NOTICE.md`
- `THIRD_PARTY_NOTICES.md`
- Run-local live Chromium report and screenshots were retained outside the
  release repository under the SFHS ignored evidence directory.

## GITHUB PAGES URL

https://falloutmule.github.io/homeostasis/

## PASS/FAIL

**PASS** - the public Pages site serves the exact verified artifact and the
ordered live Chromium proof passes.
