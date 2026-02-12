#!/usr/bin/env node
/**
 * run-tests.ts
 *
 * Small TypeScript-aware test runner for this repository.
 *
 * Behavior:
 *  - Recursively finds test files under `server/tests/` with extensions:
 *      .test.ts, .test.js, .test.mjs, .test.cjs
 *  - By default runs unit tests only (files in `server/tests/unit/**`)
 *    Set environment variable `RUN_INTEGRATION=1` to include `server/tests/integration/**`.
 *  - Dynamically imports each test file (so any `node:test` registrations execute).
 *  - Calls `run()` from the `node:test` module to execute the collected tests.
 *
 * Notes:
 *  - This file is intended to be executed with a TypeScript-capable runtime
 *    (for example `tsx run-tests.ts` or `node --loader tsx` / ts-node). It
 *    intentionally imports test files using dynamic `import()` so both `.ts`
 *    and `.js` tests are supported if your runtime loader handles them.
 *
 * Usage:
 *  - From repo root:
 *      npx tsx server/tests/run-tests.ts
 *    or (if your package.json has been updated):
 *      npm run test
 *
 *  - To include integration tests:
 *      RUN_INTEGRATION=1 npx tsx server/tests/run-tests.ts
 */

import { run } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

type TestExt = ".test.ts" | ".test.js" | ".test.mjs" | ".test.cjs";

/**
 * Configuration
 */
const TEST_ROOT = path.resolve(process.cwd(), "server", "tests");
const INCLUDE_INTEGRATION = Boolean(process.env.RUN_INTEGRATION);

/**
 * Allowed test file suffixes
 */
const TEST_SUFFIXES: TestExt[] = [
  ".test.ts",
  ".test.js",
  ".test.mjs",
  ".test.cjs",
];

/**
 * Recursively walk `dir` and collect test files.
 * Only includes files under:
 *  - server/tests/unit/**
 *  - server/tests/integration/** if INCLUDE_INTEGRATION is true
 *  - server/tests/manual/** (treated as manual tests — included only when RUN_INTEGRATION is set)
 */
async function collectTestFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (err) {
      // Directory doesn't exist — nothing to collect
      return;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        // Determine if this subtree should be visited:
        // - always visit `unit`
        // - visit `integration` only if requested
        // - visit `manual` only if integration flag set (manual tests are not unit)
        // - otherwise visit (allow other test directories like `providers`, `oauth`, etc.)
        const rel = path.relative(TEST_ROOT, full).split(path.sep)[0] || "";
        if (rel === "integration" && !INCLUDE_INTEGRATION) {
          // skip integration if not requested
          continue;
        }
        if (rel === "manual" && !INCLUDE_INTEGRATION) {
          // skip manual unless integration run explicitly requested
          continue;
        }
        await walk(full);
      } else if (entry.isFile()) {
        for (const suf of TEST_SUFFIXES) {
          if (entry.name.endsWith(suf)) {
            // If file is under integration/manual and integration not requested, skip
            const relPath = path.relative(TEST_ROOT, full);
            if (
              !INCLUDE_INTEGRATION &&
              (relPath.startsWith("integration" + path.sep) ||
                relPath.startsWith("manual" + path.sep))
            ) {
              // skip
            } else {
              results.push(full);
            }
            break;
          }
        }
      }
    }
  }

  await walk(dir);
  // Sort for deterministic ordering
  results.sort();
  return results;
}

/**
 * Convert a filesystem path to an importable file:// URL string for dynamic import.
 * On Windows it ensures the drive letter is properly formatted.
 */
function pathToFileUrl(p: string): string {
  // Use url.pathToFileURL for correctness
  return url.pathToFileURL(p).href;
}

/**
 * Import all test files so their `test()` registrations run,
 * then call node:test `run()` to execute them programmatically.
 */
async function main(): Promise<void> {
  console.log(
    `run-tests: collecting tests under ${TEST_ROOT} (INCLUDE_INTEGRATION=${INCLUDE_INTEGRATION})`,
  );

  const files = await collectTestFiles(TEST_ROOT);

  if (files.length === 0) {
    console.warn("No test files found. Exiting with success.");
    process.exit(0);
    return;
  }

  console.log(`Found ${files.length} test file(s). Importing...`);
  for (const f of files) {
    try {
      const fileUrl = pathToFileUrl(f);
      // Dynamic import — this will execute the top-level of the test file,
      // which should call into node:test to register tests.
      // Use an explicit await so import errors are caught here.
      // eslint-disable-next-line no-console
      console.log(`  import ${path.relative(process.cwd(), f)}`);
      await import(fileUrl);
    } catch (err) {
      // Import failure is a hard failure for this runner
      // Print error and exit non-zero
      // eslint-disable-next-line no-console
      console.error(`Failed to import ${f}:`, err);
      // Make sure to surface failure for CI
      process.exitCode = 1;
      return;
    }
  }

  // All test modules loaded — run the registered tests
  try {
    // node:test.run() will execute the tests and populate process.exitCode on failures
    // For Node versions where run() is not available, this will throw.
    // The try/catch ensures we provide a useful error message.
    // eslint-disable-next-line no-console
    console.log("Starting test run...\n");
    await run();
    // run() resolves when tests complete. The test harness sets process.exitCode
    const code = process.exitCode ?? 0;
    // eslint-disable-next-line no-console
    console.log(`\nTest run complete. exitCode=${code}`);
    process.exit(code);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error while running tests:", err);
    process.exitCode = 1;
    process.exit(1);
  }
}

export { collectTestFiles, main as runTests };

// If this module is executed directly, run the test runner.
// Compare import.meta.url to the entry script file URL to detect direct execution.
if (import.meta.url === pathToFileUrl(process.argv[1] || "")) {
  // Execute main() and surface any errors, setting a non-zero exit code on failure.
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
