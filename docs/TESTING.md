# Testing and verification

The release command order is `inspect`, `validate`, `check`, `pack`, `verify`, and the exact-artifact browser proof. Current results for the source below were all PASS.

| Command / check | Result |
| --- | --- |
| `pnpm sfhs inspect --json --project examples/homeostasis` | PASS |
| `pnpm sfhs validate --json --project examples/homeostasis` | PASS |
| `pnpm sfhs check --json --project examples/homeostasis` | PASS; relevant lint, typecheck, unit, packer/verifier, and browser-smoke lanes ran |
| `pnpm sfhs pack --json --project examples/homeostasis` | PASS, build `homeostasis-89abc747ea11` |
| `pnpm sfhs verify --json --project examples/homeostasis` | PASS |
| `node examples/homeostasis/tools/run-browser-proof.mjs` | PASS for Samsung S21 Ultra portrait/landscape Chrome emulation then desktop Chromium; exact artifact, one document request, no browser findings |
| `pnpm determinism` | PASS for SFHS default `pixi-minimal` fixture; it is toolchain evidence, not a HOMEOSTASIS-specific determinism claim |

Current candidate: 593,113 bytes; SHA-256 `4bf7dbb08f26daafe278188918a54b2b407778ada7bb5700052f3d1a25cbb201`; source SHA-256 `89abc747ea11d90c2f844db90ca2b64efeb06d71d8799824ec585b67397ab90e`. Evidence is in `evidence/current/homeostasis-89abc747ea11/browser/`.

| Physical Samsung Galaxy S21 Ultra / stable Android Chrome | REPORTED PASS | Direct user acceptance report for the matching artifact: everything working and no bugs seen. The report does not provide device-version, viewport, screenshot, audio, or thermal detail, so none is claimed. |

The physical report is `evidence/current/homeostasis-89abc747ea11/physical-samsung-acceptance-2026-08-06.md`. It is distinct from the passing automated browser report. The Pages gate now accepts this exact artifact only when its SHA-256 still matches the manifest.
