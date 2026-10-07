# HOMEOSTASIS

A mobile-first immune-system survivor game. Balance pathogen clearance against
inflammatory damage, then resolve the response to restore homeostasis.

Play: https://falloutmule.github.io/homeostasis/

## Controls

- Desktop: WASD or arrow keys to move, Space to Engage/Resolve, Escape to pause,
  and F3 to toggle diagnostics.
- Touch: drag on the left side to move and tap the large stance button to
  Engage/Resolve.
- Fullscreen: use Enter Fullscreen on the title or Pause screen. Portrait is
  the preferred phone layout; landscape is optional.

## Release artifact

GitHub Pages serves the root `index.html`. It is the exact, self-contained SFHS
artifact rebuilt and verified on 2026-10-07; it makes no runtime network requests beyond the
document itself.

- Build ID: `homeostasis-89abc747ea11`
- SHA-256: `4bf7dbb08f26daafe278188918a54b2b407778ada7bb5700052f3d1a25cbb201`
- Bytes: `593113`

Do not hand-edit `index.html`. Rebuild and reverify through the SFHS import
workflow before replacing it.

The Actions deployment rebuilds pinned public source, runs all SFHS and browser checks, and requires the recorded exact-artifact physical Samsung release gate. The previous release remains at `releases/2026-10-07-before/index.html`. See `GITHUB-PAGES-RELEASE.md` for release provenance.

## License

The supplied game package did not contain a license. Public availability does
not grant permission to copy, modify, or redistribute the game. See
`NOTICE.md`. Bundled SFHS and PixiJS components retain their MIT terms in
`THIRD_PARTY_NOTICES.md`.
