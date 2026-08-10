'use strict';

const crypto = require('node:crypto');

const VIEWPORT = { width: 1280, height: 800 };

// How long the wall is given to stop moving after a load or a scroll: pictures
// arrive, Textfit measures its captions once the web font is in, and Masonry
// coalesces the re-layouts those trigger 100ms at a time.
const SETTLE_MS = 2500;

// index.html pulls two web fonts off Google's CDN.  Whether that CDN answers
// says nothing about the container, so its noise stays out of the "the page
// loaded without errors" assertion.
const EXTERNAL = /fonts\.(googleapis|gstatic)\.com/;

// Finds every pair of frames whose border boxes intersect.  offsetLeft/Top are
// what Masonry writes and are unaffected by the decorative rotations in
// Gallery.css, which is exactly the geometry the manual check in CLAUDE.md
// eyeballs.
function findOverlaps() {
  const frames = Array.from(document.querySelectorAll('.PolaroidWrapper')).map((element, index) => ({
    index,
    left: element.offsetLeft,
    top: element.offsetTop,
    width: element.offsetWidth,
    height: element.offsetHeight,
  }));

  const overlaps = [];
  for (let a = 0; a < frames.length; a += 1) {
    for (let b = a + 1; b < frames.length; b += 1) {
      const one = frames[a];
      const other = frames[b];
      if (
        one.left < other.left + other.width &&
        other.left < one.left + one.width &&
        one.top < other.top + other.height &&
        other.top < one.top + one.height
      ) {
        overlaps.push(`#${one.index} and #${other.index}`);
      }
    }
  }
  return { count: frames.length, overlaps: overlaps.slice(0, 10) };
}

async function open(browser, url) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !EXTERNAL.test(message.text())) {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (!EXTERNAL.test(request.url())) {
      const failure = request.failure();
      errors.push(`requestfailed: ${request.url()} (${failure ? failure.errorText : 'unknown'})`);
    }
  });

  const images = [];
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());
    if (!pathname.startsWith('/images/')) {
      return;
    }
    images.push({
      path: pathname,
      status: response.status(),
      // The body can only be read asynchronously; keep the promise and settle
      // it before the context goes away.
      sha: response.body().then(
        (buffer) => crypto.createHash('sha256').update(buffer).digest('hex'),
        (error) => `unreadable (${error.message})`
      ),
    });
  });

  const wall = {
    page,
    errors,

    // Paths of the pictures the page has asked for so far, in request order.
    imagePaths: () => images.map((image) => image.path),

    // Same, with each response's status and the sha256 of its bytes.
    imageResponses: () => Promise.all(images.map(async (image) => ({
      path: image.path,
      status: image.status,
      sha: await image.sha,
    }))),

    frames: () => page.locator('.PolaroidWrapper').count(),

    // The wall is mounted once App's componentDidMount has pushed the config
    // into the state: either the first frame shows up, or -- on an empty wall
    // -- the gallery picks up its theme class.  Which theme is not known here
    // (it comes from the URL hash or the config), but before mount App renders
    // an empty one, so `class="Gallery "` growing a second class is the signal.
    // Polling the DOM rather than waiting for a selector: an empty gallery has
    // no size, so the `visible` state would never come.
    mounted: () => page.waitForFunction(() => (
      document.querySelector('.PolaroidWrapper') !== null ||
      Array.from(document.querySelectorAll('.Gallery')).some((gallery) => gallery.classList.length > 1)
    ), undefined, { timeout: 30000 }),

    settle: (ms = SETTLE_MS) => page.waitForTimeout(ms),

    scrollTo: (fraction) => page.evaluate((f) => {
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      window.scrollTo(0, Math.round((height - window.innerHeight) * f));
    }, fraction),

    overlaps: () => page.evaluate(findOverlaps),

    close: () => context.close(),
  };

  // `domcontentloaded` rather than `load`: the bundle is a blocking script at
  // the end of <body>, so the app is mounted by then, and waiting for `load`
  // would make every check hostage to the font CDN.
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  return wall;
}

module.exports = { open };
