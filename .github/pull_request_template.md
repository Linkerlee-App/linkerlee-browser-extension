## Summary

<!-- What changes, and why. -->

Closes #

## Checks

<!-- CI runs all of these. See CONTRIBUTING.md. -->

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npx web-ext lint --source-dir=dist --self-hosted` — 0 errors (2 known warnings)

## Manual verification

<!--
Vitest covers src/lib only; popup and options wiring is not tested. Say what you
loaded and clicked, and against which instance.
-->

## What I was careful about

- [ ] No path where the API token could reach page context, a log, or a URL
- [ ] Tag changes still send the **complete** desired set — the platform's `PUT` replaces
      rather than merges, so a partial set deletes tags
- [ ] `manifest.json` permissions not widened; host access still requested at runtime
- [ ] `scripts/patch-manifest.mjs` still applies if the background entry point moved

## Platform dependency

<!-- Does this need an API change in linkerlee-app/linkerlee first? Link the PR if so. -->

None.
