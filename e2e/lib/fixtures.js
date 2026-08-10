'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// Enough pictures to overflow a 1280x800 viewport many times over, so that
// "only the ones around the viewport were fetched" is a statement with some
// room in it.
const IMAGE_COUNT = 80;

// The wall reserves a 4:3 box for a picture it has not loaded yet, so a 4:3
// fixture keeps the layout from shifting when one arrives -- which makes the
// scroll positions the lazy-loading check samples reproducible.  Wider than the
// 20rem a polaroid is allowed to be, like a real photo, so that a loaded
// picture stretches its frame to that cap instead of shrinking it to a stamp.
const IMAGE_WIDTH = 400;
const IMAGE_HEIGHT = 300;

const TITLE = 'polaroid-wall e2e';

// The stub the Dockerfile bakes into the image and seed-storage.sh copies onto
// a fresh volume.
const STUB_TITLE = 'polaroid-wall';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

// A solid-colour truecolour PNG, written by hand so that the suite has real,
// decodable image bytes without a dependency to produce them.
function solidPng(width, height, [r, g, b]) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = 1 + width * 3;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0; // filter type: none
    for (let x = 0; x < width; x += 1) {
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function imageName(index) {
  return `fixture-${String(index).padStart(3, '0')}.png`;
}

// A polaroid has no width of its own: it is as wide as its widest content,
// capped at 20rem.  Before a picture is there, that content is the caption, so
// a caption comfortably past the cap is what makes a frame start out at its
// final size -- and the wall start out as tall as it is going to be, which is
// the whole point of the lazy-loading check.
function caption(index, count) {
  return `fixture ${String(index).padStart(3, '0')} of ${count} -- a caption wide enough to fill a polaroid`;
}

function configSource(count) {
  const images = [];
  for (let i = 1; i <= count; i += 1) {
    images.push({ title: caption(i, count), path: `images/${imageName(i)}` });
  }
  // public/index.html loads this as a plain script; JSON is a subset of the
  // object literal the app expects.
  return `const CONFIG = ${JSON.stringify({ title: TITLE, theme: 'White', images }, null, 2)};\n`;
}

// Lays out a /storage the way a real deployment's volume looks, ready to be
// `docker cp`-ed in wholesale.
function writeStorage(directory) {
  const images = path.join(directory, 'images');
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(images, { recursive: true });

  const bytes = solidPng(IMAGE_WIDTH, IMAGE_HEIGHT, [0x88, 0xc7, 0xc1]);
  for (let i = 1; i <= IMAGE_COUNT; i += 1) {
    fs.writeFileSync(path.join(images, imageName(i)), bytes);
  }

  const config = configSource(IMAGE_COUNT);
  fs.writeFileSync(path.join(directory, 'config.js'), config);

  return {
    directory,
    config,
    imageSha: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

module.exports = {
  IMAGE_COUNT,
  STUB_TITLE,
  imageName,
  writeStorage,
};
