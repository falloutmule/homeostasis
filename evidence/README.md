# Evidence index

Heavy verification evidence follows `current-plus-one-previous` retention.

- `current/homeostasis-89abc747ea11/` is the current locally packed and exactly browser-tested candidate. It is `VERIFIED` for automated checks and `BLOCKED` for physical Samsung acceptance.
- `previous/release-2026-07-24/` retains the immediately previous published release's lightweight deployment, source-policy, and rights records. Its root `index.html` remains at repository root until an Action-based Pages artifact has passed every release gate.

Browser screenshots and `report.json` are heavy evidence. No older redundant heavy evidence was found in this repository, so none was removed. Release manifests remain lightweight and are preserved in `releases/manifests/`.
