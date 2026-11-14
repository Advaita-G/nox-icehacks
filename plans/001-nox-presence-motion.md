# 001 — Give the voice room purposeful motion

- **Status**: DONE (implementation); runtime/delivery PENDING
- **Commit**: 9420b70
- **Severity**: HIGH
- **Category**: Purpose, performance, interruptibility and accessibility
- **Estimated scope**: shell CSS/markup, assistant panel CSS/markup and reveal cleanup

## Confirmed findings

| Location | Evidence | Consequence |
| --- | --- | --- |
| src/ui/shell.css:37,63–85 | Idle `breathe`, three orbital `spin` loops and a glowing brand mark | Competes with the requested single Nox presence before a task exists. |
| src/ui/shell.css:96–99,133–143 | Running glow animates box-shadow; scan moves a background; reveal animates blur/brightness/clip-path for1.1s | Repeated paint and decorative effects compete with real physics. |
| src/assistant/panel.css:1–7,49–59 | Permanently bordered chat sidebar consumes350px next to the empty stage | The opening experience reads as a workbench and text form rather than a voice assistant. |

## Target and conventions

Preserve the existing `--ease-out`, `--ease-in-out`, `--dur-micro`, `--dur-short`, `--dur-long` token names. Set them centrally in shell.css:

```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
--dur-micro: 160ms;
--dur-short: 200ms;
--dur-long: 280ms;
```

1. Remove idle spins, neon/glass gradients, running glow and animated shadows. Keep a static Nox presence when idle. Active listening/speaking can animate small state marks through transform/opacity only; these are state indicators, never claimed audio measurements.
2. Use opacity and transform transitions for the Nox-to-experiment dock change; controls remain usable throughout. Keep repeated keyboard actions immediate. Press feedback uses scale(.97) for160ms, hover color uses200ms. Do not animate width, height, layout, filters or clip-path.
3. The genuine drawing ghost fades out and the accepted model fades in over280ms. Remove the reveal class on animation end; retain a360ms cleanup fallback. Under reduced motion, skip spatial movement and remove the ghost immediately.
4. Animate an actual pending scan as a transform/opacity overlay, stop it on completion/cancel, and pair it with plain status text. Stop is always available while work is pending.
5. Drawers can use280ms transform/opacity with the shared drawer curve; do not add a motion library or change the physics clock.

## Boundaries

Implement under the user's explicit request to fix the product. The improve-animations skill supplies this audit/plan; frontend implementation follows docs/DESIGN.md. Do not stop for another design-approval round. Preserve provider validation, saved data, review/yes and stale-response cancellation. Do not generate screenshots to audit the app.

## Verification

Run affected unit tests, typecheck/build, and text-only isolated browser interactions. Inspect actual computed animations/layout at320,375,768 and1280 widths, with normal and reduced motion; verify source-photo cancellation and reveal cleanup leave no delayed run. Check first view has no visible workbench/chat form and actual running physics appears only after a user request. Human auditory/visual preference remains a separate check.
