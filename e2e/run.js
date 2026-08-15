'use strict';

// End-to-end tests for the polaroid-wall container.
//
// Builds the image, runs it the way ONCE would (port 80 published, a volume at
// /storage), seeds that volume with fixture content, and drives the resulting
// wall with Playwright.  Every check prints ok/FAIL; the process exits non-zero
// unless all of them pass.  Container and volume are throwaway and are removed
// on the way out, failure or not.
//
// Knobs:
//   E2E_SKIP_BUILD=1   reuse the image already tagged polaroid-wall
//   E2E_IMAGE=<tag>    build/run a different tag
//   E2E_PORT=<port>    publish on a specific port (default: 8080, or a free one)
//   E2E_HEADED=1       watch it happen in a visible Chrome
//
// The dependency is playwright-core rather than playwright: the two are the
// same library, but installing `playwright` downloads its own copy of three
// browsers, and this suite deliberately drives the Chrome already on the
// machine (`channel: 'chrome'`).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { chromium } = require('playwright-core');

const docker = require('./lib/docker');
const fixtures = require('./lib/fixtures');
const wall = require('./lib/wall');
const { check, step, log, summarise } = require('./lib/harness');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(__dirname, '.tmp');
const IMAGE = process.env.E2E_IMAGE || 'polaroid-wall';

// Throwaway, and named after this process so a stray run cannot collide with
// -- let alone reuse -- a volume holding somebody's actual wall.
const NAME = `polaroid-wall-e2e-${process.pid}`;
const names = { container: NAME, volume: NAME };

let cleaned = false;
function cleanup() {
  if (cleaned) {
    return;
  }
  cleaned = true;
  docker.remove(names);
  fs.rmSync(TMP, { recursive: true, force: true });
}

// Covers the ordinary end, an exception, and Ctrl-C alike: nothing survives the
// run but the image it built.
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => process.exit(1));
}

async function waitForUp(base, timeout = 60000) {
  try {
    await docker.waitFor('GET /up to answer 200', async () => {
      const response = await fetch(`${base}/up`);
      return response.status === 200;
    }, { timeout });
  } catch (error) {
    // A container that never answers has usually said why on the way down.
    error.message = `${error.message}\n--- docker logs ${names.container} ---\n${docker.logs(names.container)}`;
    throw error;
  }
}

// What "the fixture is being served" means, in one place: the volume's config
// comes back verbatim and the pictures the wall fetches are the fixture bytes.
// The image itself ships no pictures at all, so bytes that match can only have
// come out of /storage.  Returns how many pictures were served.
async function assertFixtureServed(browser, base, storage, when) {
  const health = await fetch(`${base}/up`);
  assert.equal(health.status, 200, `/up ${when}`);

  const config = await (await fetch(`${base}/config.js`)).text();
  assert.equal(config, storage.config, `/config.js is the fixture config ${when}`);

  const page = await wall.open(browser, `${base}/`);
  try {
    await page.mounted();
    assert.equal(await page.frames(), fixtures.IMAGE_COUNT, `polaroid frames ${when}`);
    await page.settle();
    const served = await page.imageResponses();
    assert.ok(served.length > 0, `some pictures were fetched ${when}`);
    for (const image of served) {
      assert.equal(image.status, 200, `${image.path} status ${when}`);
      assert.equal(image.sha, storage.imageSha, `${image.path} bytes ${when}`);
    }
    return served.length;
  } finally {
    await page.close();
  }
}

async function main() {
  const port = Number(process.env.E2E_PORT) || (await docker.pickPort(8080));
  const base = `http://localhost:${port}`;

  const leftovers = docker.removeLeftovers();
  if (leftovers) {
    log(`removed ${leftovers} leftover e2e container(s)/volume(s) from an earlier run`);
  }

  if (process.env.E2E_SKIP_BUILD === '1') {
    log(`E2E_SKIP_BUILD=1: reusing the image already tagged ${IMAGE}`);
  } else {
    await step(`docker build -t ${IMAGE} .`, () => docker.buildImage(ROOT, IMAGE));
  }

  const storage = await step(
    `generating ${fixtures.IMAGE_COUNT} fixture pictures and a config for them`,
    () => fixtures.writeStorage(path.join(TMP, 'storage'))
  );

  let browser;
  try {
    await step(`docker run -p ${port}:80 -v ${names.volume}:/storage ${IMAGE}`, () => {
      docker.createVolume(names.volume);
      docker.runContainer({ name: names.container, image: IMAGE, port, volume: names.volume });
    });
    await step('waiting for the container to come up', () => waitForUp(base));
    browser = await step('launching the machine\'s Chrome', () => chromium.launch({
      channel: 'chrome',
      headless: process.env.E2E_HEADED !== '1',
    }));

    log('');

    // 1 ------------------------------------------------------------------
    await check('healthcheck: GET /up answers 200 "ok"', async () => {
      const response = await fetch(`${base}/up`);
      assert.equal(response.status, 200, 'status');
      assert.equal((await response.text()).trim(), 'ok', 'body');
    });

    // 2 ------------------------------------------------------------------
    await check('fresh volume: the seeded stub renders an empty wall', async () => {
      const response = await fetch(`${base}/config.js`);
      assert.equal(response.status, 200, '/config.js status');
      const source = await response.text();
      assert.match(source, /title:\s*'polaroid-wall'/, '/config.js is the baked stub');
      assert.match(source, /images:\s*\[\s*\]/, '/config.js declares no pictures');

      const page = await wall.open(browser, `${base}/`);
      try {
        await page.mounted();
        assert.equal(await page.page.title(), fixtures.STUB_TITLE, 'document title');
        assert.equal(
          (await page.page.textContent('.App-header h2')).trim(),
          fixtures.STUB_TITLE,
          'rendered title'
        );
        assert.equal(await page.frames(), 0, 'polaroid frames');
        await page.settle(500);
        assert.deepEqual(page.errors, [], 'page errors');
      } finally {
        await page.close();
      }
    });

    // Content is updatable without a rebuild: this is how it is done.
    await step('seeding the volume with fixture content (docker cp)', () => {
      docker.copyInto(names.container, `${storage.directory}/.`, '/storage');
    });

    // 3 ------------------------------------------------------------------
    await check(`content from /storage: the wall renders the ${fixtures.IMAGE_COUNT} fixture pictures`, async () => {
      const served = await assertFixtureServed(browser, base, storage, 'from the seeded volume');
      return `${served} pictures served out of the volume, byte for byte`;
    });

    // 4 ------------------------------------------------------------------
    await check('lazy loading: only the pictures around the viewport are fetched', async () => {
      const page = await wall.open(browser, `${base}/`);
      try {
        await page.mounted();
        await page.settle();

        const atTop = page.imagePaths();
        assert.ok(atTop.length > 0, 'the wall fetched the pictures around the viewport');
        assert.ok(
          atTop.length < fixtures.IMAGE_COUNT / 2,
          `only a fraction of the ${fixtures.IMAGE_COUNT} pictures is fetched at the top (got ${atTop.length})`
        );

        await page.scrollTo(1);
        await page.settle();

        const atBottom = page.imagePaths();
        assert.ok(
          atBottom.length > atTop.length,
          `scrolling fetches more pictures (top: ${atTop.length}, bottom: ${atBottom.length})`
        );
        const tail = [];
        for (let i = fixtures.IMAGE_COUNT - 4; i <= fixtures.IMAGE_COUNT; i += 1) {
          tail.push(`/images/${fixtures.imageName(i)}`);
        }
        assert.ok(
          atBottom.some((requested) => tail.includes(requested)),
          `the bottom of the wall fetched its last pictures (wanted one of ${tail.join(', ')})`
        );
        assert.ok(
          atBottom.length < fixtures.IMAGE_COUNT,
          `jumping to the bottom still does not fetch the whole wall (got ${atBottom.length}/${fixtures.IMAGE_COUNT})`
        );

        return `${atTop.length} pictures at the top, ${atBottom.length} after scrolling to the bottom, of ${fixtures.IMAGE_COUNT}`;
      } finally {
        await page.close();
      }
    });

    // 5 ------------------------------------------------------------------
    await check('layout: no two polaroid frames overlap', async () => {
      const page = await wall.open(browser, `${base}/`);
      try {
        await page.mounted();
        for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
          await page.scrollTo(fraction);
          await page.settle();
          const { count, overlaps } = await page.overlaps();
          const where = `at ${Math.round(fraction * 100)}% scroll`;
          assert.equal(count, fixtures.IMAGE_COUNT, `polaroid frames ${where}`);
          assert.deepEqual(overlaps, [], `overlapping frames ${where}`);
        }
      } finally {
        await page.close();
      }
    });

    // 6 ------------------------------------------------------------------
    await check('mobile: the single-column wall is centred, and the page does not pan sideways', async () => {
      const page = await wall.open(browser, `${base}/`, { viewport: wall.PHONE_VIEWPORT });
      try {
        await page.mounted();
        await page.settle();

        const box = await page.gallery();
        assert.ok(box, 'the gallery is in the document');
        assert.equal(box.columns, 1, `the phone viewport renders a single column (columns: ${box.columns})`);
        assert.ok(
          box.right <= box.viewport,
          `the gallery does not overflow the right edge (right: ${box.right}, viewport: ${box.viewport})`
        );
        assert.ok(box.left >= 0, `the gallery does not overflow the left edge (left: ${box.left})`);

        // Masonry snaps the container to whole columns, so the leftover room is
        // rarely an even number of pixels; a couple of pixels of slack is the
        // difference between "centred" and "sub-pixel rounding".
        const gapLeft = box.left;
        const gapRight = box.viewport - box.right;
        assert.ok(
          Math.abs(gapLeft - gapRight) <= 2,
          `the gaps on either side match (left: ${gapLeft}, right: ${gapRight})`
        );

        // The gallery being inside the viewport is not the whole story: a
        // caption fitted before the web font arrived used to overflow its
        // polaroid, and the glyphs hanging out of the frame widened the
        // document even though the frames themselves were where they belonged.
        const doc = await page.documentWidth();
        assert.ok(
          doc.scrollWidth <= doc.clientWidth,
          `the page cannot be panned sideways (scrollWidth: ${doc.scrollWidth}, clientWidth: ${doc.clientWidth})`
        );

        return `${box.width}px of wall in a ${box.viewport}px viewport, ${gapLeft}/${gapRight} px either side`;
      } finally {
        await page.close();
      }
    });

    // 7 ------------------------------------------------------------------
    await check('themes: #Black / #White / #Colorful reach the gallery', async () => {
      for (const theme of ['Black', 'White', 'Colorful']) {
        // A fresh page per theme: the theme is read at mount, so switching it
        // means loading the page again, not just changing the hash.
        const page = await wall.open(browser, `${base}/#${theme}`);
        try {
          await page.mounted();
          const classes = await page.page.getAttribute('.Gallery', 'class');
          assert.ok(
            classes.split(/\s+/).includes(theme),
            `#${theme} yields class="${classes}"`
          );
        } finally {
          await page.close();
        }
      }
    });

    // 8 ------------------------------------------------------------------
    await check('restart: stop/start keeps the content on the volume', async () => {
      docker.dockerOrThrow(['stop', names.container]);
      docker.dockerOrThrow(['start', names.container]);
      await waitForUp(base);
      await assertFixtureServed(browser, base, storage, 'after stop/start');
    });

    await check('redeploy: a new container on the same volume keeps the content', async () => {
      docker.dockerOrThrow(['rm', '-f', names.container]);
      await docker.waitFor(`port ${port} to be released`, () => docker.isPortFree(port));
      docker.runContainer({ name: names.container, image: IMAGE, port, volume: names.volume });
      await waitForUp(base);
      await assertFixtureServed(browser, base, storage, 'after rm + run');
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    cleanup();
  }

  process.exitCode = summarise() ? 0 : 1;
}

main().catch((error) => {
  log('');
  log(`the suite could not run to the end: ${error && error.stack ? error.stack : error}`);
  summarise();
  process.exitCode = 1;
});
