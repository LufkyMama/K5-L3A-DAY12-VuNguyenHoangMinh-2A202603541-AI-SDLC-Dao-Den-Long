---
name: verify
description: Run all verification for the current phase and regenerate evidence (tests, headless scenarios through the real CLI, autopilot full-night replay, determinism, speed). Use before tagging a phase, after changing src/ or the contract, or when asked "does it work?".
---

# Verify a phase

1. `npm test` must be green. If red, fix the **code**; only change a test when the requirement changed, and write the reason in `docs/notes/phase-N.md`.
2. `npm run proof -- <N>` (N = phase number). It writes `docs/proof/phase-N/REPORT.md`, `test-report.txt` and `runs/*.jsonl`. Exit code 1 means some row FAILED: read the row, do not edit the report by hand.
3. New requirement → add a scenario: put `tests/scenarios/sNN-name.scenario.json` (+ `.inputs.json`) and a `check(...)` row in `tools/proof.js` whose expectation is derived from the ticket text + `game.contract.json` tuning, never copied from program output.
4. GUI playtest: `npm run playtest -- <N>` plays the browser build with real keyboard/mouse events through Chrome DevTools and writes `docs/proof/phase-N/playtest/PLAYTEST.md` + screenshots. Every check must compare against a value derived from the rules (never `x === x`). Open at least one screenshot before claiming what it shows.
5. Single still screenshots (optional, needs Chrome): run `npm start` in the background, then
   `chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=3000 --screenshot=docs/proof/phase-N/gui-X.png "http://localhost:8080/?autostart&seed=5[&lit=3][&shade]"`
   and look at the PNG before claiming what it shows.
6. Regression: `node tools/regress.mjs phase-<N-1> --drop=<fields added this phase> --skip=p<N>-` must be all SAME (proof runs it from Phase 3 on).
7. Commit the evidence together with the code it proves, then tag.
