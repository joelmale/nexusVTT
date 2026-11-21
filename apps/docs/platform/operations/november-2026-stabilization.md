# November 2026 stabilization plan

The baseline is `f79c8e14` and the
[November 16 weekly validation run](https://github.com/joelmale/nexusVTT/actions/runs/43880409319).
That run passed database integration and multiplayer soak. Managed Chromium and
three container security checks failed.

## Execution order

1. Restore managed browser validation. Update the Forge and VTT creator matrix for the single wizard, retain both persisted editions and save/reload checks, and resolve the Studio NPC write failure with response diagnostics. Run the full managed suite, including the multiplayer recovery cases.
2. Refresh container bases for the affected services. Compare the Dependabot update, rebuild candidate images, and scan the exact resulting images with the existing Trivy policy before release.
3. Publish a repository handoff and bring first-run guides in line with the creator, Studio, and monorepo setup. Build the documentation with link checking enabled.
4. Isolate Codex scorer tests from the growing gold set, register them in CI, and record a held-out baseline using saved predictions or a running evaluation service.

## Acceptance and follow-up

| Work | Completion evidence |
| --- | --- |
| Managed browser suite | `npm run test:e2e --workspace nexus-vtt` passes on freshly built local images. Forge and VTT both resume and save 2014 and 2024 fixtures. Studio persists an NPC holder, an item, an inbox note, and a pin. |
| Container refresh | Rebuild the affected Node Alpine images and check them with Trivy using the repository's fixed HIGH/CRITICAL policy. The [delivery workflow](../ci-cd-pipelines.md#delivery-lane) ties release evidence to published image digests. |
| Documentation | The [Forge creator guide](/forge/character-creation), [VTT onboarding](/vtt/features/character-onboarding), and Studio setup reflect the current entry points and persistence model. `npm run test:docs` passes. |
| Codex evaluation | The synthetic scorer suite passes in Codex CI. The real held-out baseline requires reviewed pages outside the tuning set and predictions from the same frozen version. |

## Codex held-out baseline

`goldset@1` has zero verified held-out pages. The scorer stops with
`No verified pages in split "heldout".` The existing scorecard covers tuning
pages. Use the [gold-set review guide](/codex/goldset-review) to label and verify
new pages, freeze the set, run the model, and archive the predictions with the
JSON and Markdown scorecards.
