# Source and release policy

- Root `index.html` is the GitHub Pages release artifact.
- The artifact is generated from the repository-local SFHS import workflow; it
  is not an authored edit surface.
- A replacement may be published only after SFHS inspect, validate, check,
  build, pack, verify, and exact-artifact browser testing pass.
- Runtime JavaScript, CSS, fonts, and assets remain embedded in the one HTML
  file. External runtime dependencies are not allowed.
- Authored HOMEOSTASIS code has no `eval` or dynamic `Function`. The required
  bundled PixiJS adapter contains PixiJS renderer feature detection/code
  generation that uses `new Function`; this is third-party adapter code and is
  recorded rather than misrepresented as authored game logic.
- `window.CR.runFullSelfCheck()` is the release self-check contract.
