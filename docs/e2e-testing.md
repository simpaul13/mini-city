# Browser end-to-end tests

The project uses [e2e-inc/e2e](https://github.com/e2e-inc/e2e), with its
`e2e` runner and `@e2e-dev/web` Chromium engine. Tests are **code-only**:
no AI agent, model provider, API key or subscription login is configured or
required. This follows the clarified scope in issue #13. No production UI or
save format changes are required.

## Prerequisites

- Node.js **22.22.3+ on Node 22**, or **24.8+** on a newer release, as required
  by e2e. On Windows, use **WSL**, following the framework's
  [quickstart](https://e2e.com/docs/quickstart).
- `npm ci` in this checkout. Install dependencies inside WSL if running there;
  do not share a Windows `node_modules` directory with Linux.
- Internet access on the first browser run: e2e downloads its matching
  Playwright Chromium browser automatically. Linux environments also need
  Chromium's system libraries; use `npx playwright install-deps chromium`
  when the runner reports missing libraries.

## Run locally

```sh
npm ci
npm run test:e2e:typecheck
npm run test:e2e
```

The runner starts Vite on an available loopback port and stops it afterward;
there is no separate dev-server command or fixed-port requirement. Each test
attempt uses a fresh browser context/IndexedDB save slot, not your normal
browser's save. The viewport is desktop 1440 × 900, light theme, en-US locale.

The smoke workflow creates a seeded Flat Plains city, checks the starting
population and treasury, changes render quality, builds a house, saves,
returns to the main menu, reloads the document, and continues the saved city.
It verifies the restored seed, population and spent treasury, then bulldozes
the restored house and verifies the refund. This checks nonempty construction
persistence rather than only saved world metadata.

```sh
# Run only smoke-tagged tests:
npm run test:e2e:smoke
# Show the browser or inspect detailed runner output:
npm run test:e2e -- --headed
npm run test:e2e -- --debug
```

All browser tests use explicit coded interactions and assertions. There are
no model calls or credential-dependent skipped tests. Browser tests complement,
rather than replace, `npm test` and `npm run build`.

## Results and maintenance

Results are written to `.e2e/report.json`; failed attempts retain a trace under
`.e2e/results/`, and Vite output goes to `.e2e/logs/app.log`. Generated reports,
cache, sessions and logs are gitignored. Traces may contain screenshots and
page contents: inspect them before sharing.

Tests live in `tests/*.e2e.ts`, separate from Vitest's `*.test.ts` files.
Role/label queries drive forms and buttons, while a few existing DOM IDs make
assertions precise. The smoke test places/clears a house at the canvas's
relative center for a fixed seed and desktop viewport; that small canvas check
may need adjustment if the initial camera or layout changes. Tests do not use
fixed sleeps, test-only application globals or mocked browser actions. When
workflows change, update their actions and expected outcomes together.

Road dragging and long-duration GPU stability are not covered by this suite.
