# Tests — organization and runbook

This repository's tests are organized to make intent, runtime cost, and CI behavior explicit.
Use these guidelines to run tests locally, add new tests, or change test classification.

Top-level test categories
- `unit/` — Fast, deterministic tests meant to run in CI and on every PR.
  - `unit/providers/` — provider unit tests (OpenAI, Anthropic, Gemini). These use lightweight mocks and assert parsing / request shape.
  - `unit/oauth/` — OAuth and device-flow unit tests. They mock network interactions via injected `fetch` functions or test helpers.
  - `unit/packer/` — core algorithmic tests for packers (hierarchical/force-directed). Prefer deterministic seeds.

- `integration/` — Integration tests that exercise multi-component flows (local provider + packer, end-to-end validation). These can be CPU- or time-intensive and are gated from default CI runs.

- `manual/` — Developer utilities, one-off debugging scripts, and human-driven capture utilities. These are intentionally not run in CI.
  - `manual/visual/` — visual HTML debug pages (open in a browser).

Why this separation
- Unit tests: short, hermetic, and reliable — they should fail only when behavior regresses.
- Integration tests: validate end-to-end correctness and surface integration regressions, but can be slower or require specific environment.
- Manual tests: tools for developer debugging and capturing real data (e.g., paste-in responses). Not suitable for CI.

How to run tests locally
- Run all unit tests:
  - node --test server/tests/unit
- Run a single unit test file:
  - node --test server/tests/unit/providers/openaiProvider.test.js
- Run integration tests (opt-in):
  - RUN_INTEGRATION=1 node --test server/tests/integration
- Run ALL tests (including manual) — not recommended for CI:
  - node --test server/tests

Recommended npm scripts (example)
Add to `package.json`:
{
  "scripts": {
    "test": "node --test server/tests/unit",
    "test:unit": "node --test server/tests/unit",
    "test:integration": "RUN_INTEGRATION=1 node --test server/tests/integration",
    "test:all": "node --test server/tests"
  }
}

CI recommendations
- Configure CI to run `npm test` (or `node --test server/tests/unit`) on every PR.
- Run integration/perf tests on a daily/nightly schedule or gated on a specific branch.
- Do not run `manual/` tests in CI.

Converting or adding tests — guidelines
- Prefer `node:test` + `assert` for new tests. Avoid scripts that rely on `console.log` or `process.exit`.
- Make network interactions mockable. Providers in this project expose `createClient`/injection points — inject lightweight mocks in tests instead of real API calls.
- Use deterministic seeds for packer/algorithm tests so results are stable across runs.
- If a test is slow or non-deterministic, move it to `integration/` or gate it with an env var (e.g. `if (!process.env.RUN_INTEGRATION) test.skip(...)`).

How to handle imports when moving tests
When tests are relocated, update relative import paths. Typical replacements:
- Tests moved deeper by one level: `"../providers/..."` -> `"../../providers/..."`
- Example: if a test was `import localProvider from '../providers/localProvider.js'` and it moves from `server/tests/` to `server/tests/integration/`, update to:
  - `import localProvider from '../../providers/localProvider.js'`

I will only update the imports in moved test files; source modules under `server/` are not modified.

Test hygiene checklist (quick)
- No real network calls in unit tests (mock them).
- No dependence on external env unless the test is integration; if required, document env vars.
- Avoid `process.exit()` in tests — use assertions or `test.fail()` behavior.
- Mark heavy/long tests clearly and place them in `integration/` or `manual/`.

Manual utilities and capture workflows
- Files in `server/tests/manual/` are developer-facing:
  - `capture-openai-layout.js` — paste real OpenAI response JSON into the file per the header instructions, then run with `node` to analyze.
  - Visual HTML files can be opened in a browser for inspection/debugging.
- Document any manual steps in the individual file headers to avoid confusion.

If you want help
- I can:
  - Add (or update) npm scripts in `package.json`.
  - Convert a console-driven script into a proper `node:test` test (pick a file).
  - Move additional tests between categories and update imports.
  - Add small test helpers (mockFetch, fixtures) to `server/tests/helpers/`.

Notes
- This README is intentionally brief — each manual/complex test should include file-level instructions at the top describing usage and any required manual steps or fixtures.
- Keep test run time in mind: CI fast path should stay fast (< 60s, ideally < 30s).

Happy testing — tell me if you want me to:
- convert a specific manual script into a unit test,
- add the recommended `package.json` scripts,
- or create a small `server/tests/helpers` set of mock utilities.