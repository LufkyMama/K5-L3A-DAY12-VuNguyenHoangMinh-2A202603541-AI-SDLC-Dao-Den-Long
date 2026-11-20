# Đảo Đèn Lồng: agent guide

3D third-person game (Three.js in the browser) plus a deterministic headless mode for automatic grading.
Requirements: `docs/notes/phase-N.md` (copied from the lab board) + `game.contract.json` (Test Contract v1.0).

## Commands
- Install: `npm install` · Play: `npm start` → http://localhost:8080
- Tests: `npm test` (node:test, runs the real headless CLI) · Evidence: `npm run proof -- <phase>`
- GUI playtest: `npm run playtest -- <phase>` (needs Chrome; starts its own server, plays with real key/mouse events, writes `docs/proof/phase-N/playtest/`)
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f] [--snapshot-every n]`

## Layout
- `src/sim.js`: **all** gameplay rules, pure + deterministic (seeded RNG, integer tick timers, no Math.random/Date).
- `src/tuning.js`: the only place for numbers. `game.contract.json` tuning must equal it (a test enforces this).
- `src/headless.js` CLI · `src/validate.js` input/scenario validation (bad file → exit 2).
- `web/`: rendering, input, HUD, sound only. Never put rules there.
- `tests/`: behaviour tests through the CLI · `tests/scenarios/`: named scenario files · `tools/proof.js`: evidence report.

## Rules
- Tick model: step k reads input of tick k → state k+1, events tagged k+1. Distances are XZ, "within r" is ≤ r: always use `within()` / `r + EPS` in sim.js, never a bare `<= r` (float error at exact radii).
- Before tagging, run the `contract-reviewer` agent; every defect it finds gets a regression test that fails on the old code.
- Creative extras must be gated by `creative` (GUI only); headless output must not change.
- Expected values in tests come from the ticket/contract text, never from copying program output.
- A Stop hook runs the tests and blocks finishing while they are red. Don't bypass it; fix the code.
- When a ticket changes a rule: update `docs/notes/phase-N.md` (why), the code, then fix or retire old tests with a reason.
- Small commits, one concern each. Tag `phase-N` only after `npm run proof` passes.
