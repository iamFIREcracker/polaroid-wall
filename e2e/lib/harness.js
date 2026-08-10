'use strict';

// A check runner small enough to read in one sitting: every check is labelled,
// runs even if an earlier one failed (how far the container got is the
// interesting part of a failing run), and the process ends non-zero unless all
// of them passed.

const checks = [];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function indent(text) {
  return String(text)
    .split('\n')
    .map((line) => `       ${line}`)
    .join('\n');
}

// Whatever a check returns is printed next to its ok, for the numbers that are
// worth seeing even when nothing is wrong.
async function check(label, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    checks.push({ label, ok: true });
    log(`  ok    ${label}${detail ? ` -- ${detail}` : ''}  (${seconds}s)`);
  } catch (error) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    checks.push({ label, ok: false, error });
    log(`  FAIL  ${label}  (${seconds}s)`);
    log(indent(error && error.stack ? error.stack : error));
  }
}

// Everything a check needs but that is not itself under test -- building the
// image, seeding the volume, restarting the container -- goes through here:
// a broken step is reported as such instead of masquerading as a failed check.
async function step(label, fn) {
  log(`  ..    ${label}`);
  try {
    return await fn();
  } catch (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
}

function summarise() {
  log('');
  if (checks.length === 0) {
    log('no checks ran');
    return false;
  }
  const failed = checks.filter((c) => !c.ok);
  log(`${checks.length - failed.length}/${checks.length} checks passed`);
  for (const { label } of failed) {
    log(`  FAILED: ${label}`);
  }
  return failed.length === 0;
}

module.exports = { check, step, log, summarise };
