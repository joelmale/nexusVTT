# RESUME_PROTOCOL — boot sequence for every roadmap session

You are a stateless orchestrator session. This conversation has no memory of prior sessions.
The files in `docs/roadmap/` are the ONLY shared state. Follow this sequence exactly.

## §1 Boot

1. Read [SESSION_STATE.md](SESSION_STATE.md).
2. Candidate packets = status `todo` whose `depends_on` are all `done` AND whose blocking-gate
   ancestors are `gate:approved`. If Joel named a packet, take it (verify it's actually unblocked;
   if not, say so and stop). Otherwise pick by ROADMAP.md's "Suggested next" or DAG order.
3. Read the packet's brief in [SESSION_BRIEFS/](SESSION_BRIEFS/) fully. Read every ADR it cites.
4. If any `open_rulings` in SESSION_STATE.md touch this packet — resolve with Joel first.

## §2 Drift check (mandatory, before any delegation)

The codebase has changed since the brief was written (other packets land commits independently).

1. Run the brief's `Drift check` block verbatim (T0 — plain Bash, no agents).
2. Classify each fact: **confirmed** (proceed) or **drifted** (path moved, line shifted
   materially, API changed, prerequisite missing).
3. Drifted facts → scoped T1 re-scout of ONLY the drifted area (one Haiku agent, one objective:
   "re-pin these N facts"). Update the brief's Ground truth section in place with the new facts
   + new `verified @ <commit>` annotation. Log the drift in SESSION_STATE.md §Known drift.
4. A missing prerequisite (e.g. brief assumes A4's slices, `src/stores/scene/` absent) means the
   packet is BLOCKED regardless of what SESSION_STATE claims — fix the state file, pick another
   packet.

## §3 Execute

1. Announce the delegation plan (tiers, agents, budget) to Joel before dispatching.
2. Tier policy (binding):

| Tier | Engine | Use for | Never for |
|---|---|---|---|
| T0 | Deterministic scripts / plain Bash | Codemods, pipelines, censuses, diffs, harnesses | Anything needing judgment |
| T1 | claude-haiku-4-5 | Mechanical scans, fact re-pinning, spot-checks, batched classification | Architecture, code generation |
| T2 | claude-sonnet-4-6 (Agent tool `model: sonnet`) | Focused single-objective build/analysis per the brief's delegation plan | Cross-cutting tradeoffs |
| T3 | Orchestrator (Fable) | Synthesis, arbitration, reviews, gate packets | What T0–T2 already handled |

3. Escalate only on failure or ambiguity. T2 scope = exactly one objective; no freelancing.
4. Work on branch `packet/<id>-<slug>`. Never commit to master directly. Commit messages
   reference the packet id.
5. Budget discipline: at ~80% of the brief's cap without exit criteria met → checkpoint
   (commit clean, flag off if applicable), split the remainder into a new packet
   (add brief + ROADMAP row + STATE row), close honestly as `split`.

## §4 Handoff contract (every agent returns exactly this)

```yaml
agent: <name>
tier: <T0|T1|T2>
inputs_consumed: [<brief sections / digest ids>]
findings: [<bullet facts, max 10>]
recommendations: [<ranked, max 5>]
artifacts: [<code/diagrams/reports, labeled>]
open_questions: [<things needing T3 arbitration>]
confidence: <high|medium|low>
```

`confidence: medium|low` OR non-empty `open_questions` → T3 verifies (targeted greps/reads)
before the output is used downstream. This rule has caught invented event names and wrong
coordinate math before — do not skip it.

## §5 Close-out (before ending the session)

1. Run the brief's Exit criteria. Report results honestly — a failed criterion means the packet
   is NOT done; either fix within budget or checkpoint per §3.5.
2. Working tree clean; branch pushed. Blocking-gate packets: prepare the review packet
   (diff summary + gate evidence) and tell Joel review is needed; set `gate:pending`.
3. Update SESSION_STATE.md: packet status, `last_commit`, gate status, any drift found,
   any new open_rulings.
4. Append a row to SESSION_STATE.md §Session log: date, packet, outcome, actual token spend by
   tier (estimate honestly), escalations, one-line note for the next session.
5. If this session changed ROADMAP-level facts (new packet from a split, dependency change,
   ADR superseded) — update ROADMAP.md in the same commit.

## §6 Invariants (do not violate, do not re-litigate)

- ADRs in [ADR/](ADR/) are binding until superseded by a new numbered ADR with Joel's sign-off.
- NexusCodex is a document service. It gains no asset semantics, ever (ADR-0001).
- Coordinate math: `sceneUtils` only (ADR-0002). Placement: `token/place`, unversioned (ADR-0003).
- No packet ends mid-refactor. Blocking gates block — dependents wait for `gate:approved`.
- Model asset-file processing is forbidden in Track B beyond B1's bounded residue (ADR-0014).
