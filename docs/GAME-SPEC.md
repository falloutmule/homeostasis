# HOMEOSTASIS game specification

## Product

HOMEOSTASIS is a mobile-first, single-player immune-system survivor game. The player balances pathogen clearance against inflammatory tissue damage, then deliberately resolves the response to restore homeostasis.

It targets stable Android Chrome on a Samsung Galaxy S21 Ultra first, in portrait-first adaptive layout with optional landscape, and desktop Chromium second. It is a self-contained browser game: no account, network service, or downloaded runtime asset is required.

## Player experience and loop

Move a response core through tissue, engage nearby pathogens, collect XP, choose upgrades, and defeat the pathogen boss. Engagement damages pathogens but can increase inflammation and collateral injury. Resolve disables attacks, lowers inflammation, suppresses shake, and repairs nearby tissue. Success requires defeating the boss, controlling the remaining pathogen load, staying within the response safe band, and holding that stable state.

Loss can result from response-core death, tissue collapse, sustained cytokine storm, or infection runaway. The rules are deterministic for a supplied seed and simulate at 60 Hz with a capped frame delta.

## Controls and accessibility

| Context | Control |
| --- | --- |
| Touch | Drag on the left side to move; tap the large stance button to switch Engage/Resolve. |
| Desktop | WASD or arrow keys move; Space switches stance; Escape pauses; F3 toggles diagnostics. |
| All | Title and Pause overlays offer fullscreen; Pause offers mute/unmute and restart. |

The game uses visible semantic buttons and accessible stance labels. It automatically clears input on blur, page hiding, pause, upgrades, result screens, and visibility pause to avoid stuck movement. WebGL is required; unsupported browsers receive a capability message rather than a renderer fallback.

## Systems and content

- Procedural tissue, bacteria, response-core, Resolve field, particles, boss, HUD, and Web Audio feedback.
- Pathogen bacteria, a boss with matrix/core health, tissue targets, pickups, neutrophils, complement, and antibody systems.
- Randomized three-choice upgrades, each limited to three tiers. Current implemented upgrades include reach, regulatory response, neutrophils, chemotaxis, complement, antibodies, platelet repair, and efferocytosis.
- HUD exposes tissue integrity, pathogen load, response safe band, current stance, XP, and run state.
- Settings persistence is optional localStorage key `homeostasis.settings.v1`, schema version 1, containing `muted` and `bestIndex`. It gracefully continues if storage is unavailable.

## Visual, audio, and technical direction

The visual direction is procedural microscopic tissue with a legible mobile HUD. The SFHS `pixi-v8` adapter owns the required visible Pixi/WebGL surface. Legacy authored procedural sprite surfaces are retained for the game presentation through the adapter compatibility layer. Audio is synthesized with Web Audio after user interaction; no sound files are downloaded.

The page is one packed HTML document. Runtime external URLs, external fonts, external CSS, remote assets, dynamic chunks, and network gameplay are disallowed. The author-authored game code has no `eval` or dynamic `Function`; bundled PixiJS feature detection may contain `new Function`, recorded as third-party adapter code in the import differences and notices.

## Constraints, non-goals, and unresolved decisions

Verified current behavior is documented above. This graduation does not approve new levels, story, monetization, multiplayer, cloud saves, native packaging, controller support, localization, or a gameplay/art redesign. The only current release decision still unresolved is direct Samsung Galaxy S21 Ultra acceptance of the exact candidate build; reuse licensing is separately unresolved.
