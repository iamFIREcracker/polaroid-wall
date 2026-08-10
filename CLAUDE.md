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

and open <http://localhost:3111> in a normal window -- no need for incognito:
the app does not register a service worker any more, and `src/index.js` calls
`unregister()` (from `src/registerServiceWorker.js`) to tear down any worker a
browser is still carrying from before. A browser that visited the wall back
then converges after a couple of reloads, once, and stays clean afterwards.

We picked unregistering over keeping the worker: offline support and precaching
buy a picture wall very little, and a stale app shell after a deploy (the "N+1
visit" problem) is exactly what we do not want. `src/registerServiceWorker.js`
stays around for its `unregister()`; the production build still emits
`build/service-worker.js` (sw-precache is not switchable off in CRA 1.x without
ejecting), and that is fine -- an old visitor fetches it, it serves the new
bundle, and the new bundle unregisters it.

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


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
