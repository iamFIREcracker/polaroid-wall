# polaroid-wall

A wall of polaroids: `public/config.js` (a symlink to Dropbox) declares the
title, the theme and the list of pictures; `src/App.js` reads it from the
`CONFIG` global and hands it over to `src/Gallery.js`, which lays the polaroids
out with Masonry. Pictures are loaded lazily, by `src/LazyImage.js`.

## Building and running

This is create-react-app 1.x (React 15, webpack 3), which needs some coaxing on
a modern Node:

- `npm start` **does not work**: webpack-dev-server 2 calls
  `process.binding('http_parser')`, gone since Node 12.
- `npm install` needs `--legacy-peer-deps`: react-textfit declares a peer
  dependency on React 0.14.
- `npm run build` needs `NODE_OPTIONS=--openssl-legacy-provider`, else webpack 3
  dies trying to hash with md4.
- `npm test` fails at `CONFIG is not defined` (the global comes from
  `public/config.js` at runtime, and jsdom never loads it). Pre-existing.

So, to see the wall:

```bash
npm install --legacy-peer-deps                         # once
NODE_OPTIONS=--openssl-legacy-provider npm run build
python3 -m http.server 3111 --directory build
```

and open <http://localhost:3111> in an **incognito window**: the app registers a
service worker, which otherwise serves a stale bundle after every rebuild.

Themes can be switched from the URL: `#Black`, `#White`, `#Colorful`.

To check it on a phone, serve the same folder and reach it at
`http://<this-machine-ip>:3111` over wifi.

## Testing the lazy loading

With the wall open, and DevTools on:

- **Network tab, filter `Img`, "Disable cache" checked**, then reload: only the
  pictures around the viewport are fetched (roughly 25 out of 172 on a laptop
  screen), not the whole wall. Scrolling fetches more; jumping straight to the
  bottom only fetches the pictures around *there*.
- **Throttle to "Slow 4G"** and reload to actually watch it work: empty polaroid
  frames, each holding a faint grey box, filling in as they scroll into view.
- **The scrollbar** is full-length from the start -- frames reserve room for the
  picture they are waiting for -- instead of growing as the wall loads.
- **Nothing overlaps**: polaroids get their real size late (pictures show up
  when scrolled into view, captions when the web font arrives), and Masonry is
  told to lay the wall out again every time one of them settles. Overlapping
  polaroids mean that mechanism broke.

Automated version of the same checks: drive the page with Playwright (installed
out of tree, `chromium.launch({ channel: 'chrome' })` reuses the Chrome that is
already on the machine), count `.PolaroidWrapper` frames against
`.Polaroid .ImageWrapper img` elements and image requests, and compare every
frame's `offsetLeft/Top/Width/Height` against every other one to catch overlaps.
Sample at a few scroll positions, and give the page a couple of seconds to
settle before measuring. `Emulation.setCPUThrottlingRate` over CDP is a decent
stand-in for a phone.
