# HOMEOSTASIS SFHS import differences

## Preserved behavior

- VS-004 gameplay constants, seeded randomness, 60 Hz fixed-step simulation,
  scenes, controls, HUD wording, procedural visuals and audio, upgrade choices,
  damage attribution, win/loss rules, and Resolve mechanics are preserved.
- The settings key remains `homeostasis.settings.v1` with schema version `1`
  and the same `muted` and `bestIndex` fields.
- The legacy `window.__HOMEOSTASIS_TEST__` interface remains available.
- Runtime external URLs remain forbidden and the generated deliverable remains
  one self-contained HTML file.

## Intentional migration differences

1. The prototype's inline HTML/CSS/JavaScript is split into authored files under
   `src/`; `dist/index.html` is generated and must not be hand-edited.
2. SFHS v0.1 accepts only the `pixi-v8` adapter and its public project API does
   not expose a dynamic-canvas texture surface. The original Canvas 2D world is
   therefore retained as the sole visible game renderer above a live,
   adapter-owned PixiJS WebGL surface. Game simulation and draw routines remain
   unchanged; WebGL is still mandatory and there is no fallback when it is
   unavailable.
3. WebGL is required. Unsupported environments receive an honest capability
   message instead of silently using a renderer outside the SFHS contract.
4. The title button also serves as SFHS `#fixture-start`; the application shell
   exposes SFHS lifecycle phases and `window.CR` supplies snapshot/self-check
   evidence. These additions do not replace the game's legacy test hook.
5. Input is explicitly cleared on blur, page hide, pause, upgrade, result, and
   visibility pause to prevent stuck movement after lifecycle transitions.
6. SFHS supplies generated source/artifact hashes and a build descriptor in the
   packed HTML. The in-game VS-004 build label remains unchanged for provenance.
7. The imported legacy monolith carries narrow lint and TypeScript checking
   suppressions; new typed presentation code remains under normal repository
   checks. This is a tooling annotation only and does not alter runtime behavior.
8. The legacy forced-victory test helper now suppresses director spawns and
   clears test-injected pending XP/upgrade state while it advances the final
   deterministic window. Normal runs use the unchanged director and
   progression behavior.
9. The authored prototype contains no `eval` or dynamic `Function`. The packed
   artifact necessarily includes PixiJS 8.19.0 through the required SFHS
   adapter; PixiJS renderer feature detection/code generation contains
   `new Function`. This is bundled third-party adapter code, not added gameplay
   logic, and its MIT notice must accompany public copies.

## Honest limitations

- This is a behavior-preserving migration, not byte or pixel equivalence.
- Samsung Galaxy S21 Ultra results produced here are Chromium device emulation;
  they do not constitute physical-device acceptance.
- The source package supplied no explicit license, so publication and
  redistribution remain blocked pending an owner license decision.
