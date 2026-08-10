'use strict';

const { spawnSync } = require('node:child_process');
const net = require('node:net');

// Every container and volume the suite creates carries this label, so a run
// that was killed halfway through can be cleaned up by the next one without
// ever guessing at names that might belong to a real deployment.  The value is
// the pid of the run that created it: a sweep only takes what belongs to a
// process that is gone, so two suites running at once do not tear down each
// other's container mid-check.
const LABEL = 'polaroid-wall-e2e';
const OWNER = String(process.pid);

function docker(args, { capture = true } = {}) {
  return spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function dockerOrThrow(args, options) {
  const result = docker(args, options);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`docker ${args.join(' ')} exited ${result.status}\n${output}`);
  }
  return (result.stdout || '').trim();
}

function buildImage(context, tag) {
  // Streamed rather than captured: a Docker build is the slow part of the run
  // and watching it is the only way to tell a slow build from a hung one.
  const result = docker(['build', '-t', tag, context], { capture: false });
  if (result.status !== 0) {
    throw new Error(`docker build -t ${tag} ${context} exited ${result.status}`);
  }
}

function createVolume(name) {
  dockerOrThrow(['volume', 'create', '--label', `${LABEL}=${OWNER}`, name]);
}

function runContainer({ name, image, port, volume }) {
  dockerOrThrow([
    'run', '-d',
    '--name', name,
    '--label', `${LABEL}=${OWNER}`,
    '-p', `${port}:80`,
    '-v', `${volume}:/storage`,
    image,
  ]);
}

function copyInto(container, hostPath, containerPath) {
  dockerOrThrow(['cp', hostPath, `${container}:${containerPath}`]);
}

function logs(container) {
  const result = docker(['logs', container]);
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
}

// Best effort, and quiet: this runs from a process exit handler, where throwing
// would only bury whatever made the run end in the first place.
function remove({ container, volume }) {
  if (container) {
    docker(['rm', '-f', container]);
  }
  if (volume) {
    docker(['volume', 'rm', '-f', volume]);
  }
}

// Is the run that created a labelled container/volume still around?  An
// unparseable value means the label predates the pid convention, i.e. nobody
// owns it any more.
function ownerAlive(value) {
  const pid = Number(value);
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Alive, just running as somebody else.
    return error.code === 'EPERM';
  }
}

// `<id-or-name> <owner-pid>` lines into the ids whose owner is gone.
function orphans(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(' ');
      return separator === -1
        ? { id: line, owner: '' }
        : { id: line.slice(0, separator), owner: line.slice(separator + 1).trim() };
    })
    .filter(({ owner }) => !ownerAlive(owner))
    .map(({ id }) => id);
}

function removeLeftovers() {
  const format = `{{.ID}} {{.Label "${LABEL}"}}`;
  const containers = orphans(
    dockerOrThrow(['ps', '-a', '--filter', `label=${LABEL}`, '--format', format])
  );
  if (containers.length) {
    docker(['rm', '-f', ...containers]);
  }
  const volumes = orphans(
    dockerOrThrow([
      'volume', 'ls', '--filter', `label=${LABEL}`, '--format', `{{.Name}} {{.Label "${LABEL}"}}`,
    ])
  );
  if (volumes.length) {
    docker(['volume', 'rm', '-f', ...volumes]);
  }
  return containers.length + volumes.length;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '0.0.0.0');
  });
}

async function pickPort(preferred) {
  if (await isPortFree(preferred)) {
    return preferred;
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(what, predicate, { timeout = 60000, interval = 500 } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  for (;;) {
    try {
      if (await predicate()) {
        return;
      }
    } catch (error) {
      last = error;
    }
    if (Date.now() >= deadline) {
      throw new Error(`timed out after ${timeout}ms waiting for ${what}${last ? ` (last error: ${last.message})` : ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

module.exports = {
  buildImage,
  copyInto,
  createVolume,
  docker,
  dockerOrThrow,
  isPortFree,
  logs,
  pickPort,
  remove,
  removeLeftovers,
  runContainer,
  waitFor,
};
