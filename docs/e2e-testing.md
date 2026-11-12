# Browser end-to-end tests

The project uses [e2e-inc/e2e](https://github.com/e2e-inc/e2e), with its
`e2e` runner and `@e2e-dev/web` Chromium engine. No production UI or save format
changes are required.

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
- For the AI suite only, a model supporting image input and tool calls, and
  credentials for that provider. The default config uses **Vercel AI Gateway**.

## Run locally

```sh
npm ci
npm run test:e2e:typecheck
npm run test:e2e:smoke
```

The smoke test needs **no API key**. It creates a seeded Flat Plains city,
checks the starting population and treasury, changes render quality, builds a
house, saves, returns to the main menu, reloads the document, and continues the
saved city. It verifies the restored seed, population and spent treasury, then
bulldozes the restored house and verifies the refund. This checks nonempty
construction persistence rather than only saved world metadata.

The runner starts Vite on an available loopback port and stops it afterward;
there is no separate dev-server command or fixed-port requirement. Each test
attempt uses a fresh browser context/IndexedDB save slot, not your normal
browser's save. The viewport is desktop 1440 × 900, light theme, en-US locale.

## AI-powered workflow

Export a gateway key in the same shell where you run tests (never commit it):

```sh
export AI_GATEWAY_API_KEY='your-key'
# Optional: another image/tool-capable model available through your gateway.
export E2E_MODEL='openai/gpt-6-luna-fast'
npm run test:e2e:ai
```

`test:e2e:ai` runs uncached natural-language actions for new-world navigation,
seed/landscape form entry, city creation, settings, saving and resuming after
a reload. Explicit assertions verify each goal. It intentionally **fails**
without model authentication rather than skipping the requested AI coverage.
Model calls may incur provider charges. The AI journey uses an empty city;
the smoke journey separately covers house construction and bulldozing. Road
dragging and GPU stability are not covered.

To use a direct provider, subscription or local model instead, follow the
[e2e model documentation](https://e2e.com/docs/models) and replace the
`gateway(...)` model in `e2e.config.ts` with that provider's AI SDK model.
Changing `E2E_MODEL` selects a gateway model ID, not a different provider.
The runner does not automatically load `.env` files; export variables in your
shell or explicitly load a private env file in the config. Do not put keys in
source files, test prompts, reports or GitHub comments.

Run all browser tests after configuring the model:

```sh
npm run test:e2e
# Show the browser or narrow a test while debugging:
npm run test:e2e:smoke -- --headed
npm run test:e2e -- --tag ai --debug
```

Normal `test:e2e` runs can replay validated agent actions from the local cache;
`test:e2e:ai` disables that cache so a passing run demonstrates live model
interactions. Neither command replaces `npm test` or `npm run build`.

## Results and maintenance

Results are written to `.e2e/report.json`; failed attempts retain a trace under
`.e2e/results/`, and Vite output goes to `.e2e/logs/app.log`. Generated reports,
cache, sessions and logs are gitignored. Traces may contain screenshots and
page contents: inspect them before sharing.

Tests live in `tests/*.e2e.ts`, separate from Vitest's `*.test.ts` files.
Natural-language goals drive the AI workflow, while role/label queries and a
few existing DOM IDs make assertions precise. The smoke test places/clears a
house at the canvas's relative center for a fixed seed and desktop viewport;
that small canvas check may need adjustment if the initial camera or layout
changes. The AI test does not hard-code pointer coordinates. Neither test uses
fixed sleeps, test-only application globals or mocked browser actions. When
workflows change, update their goals and expected outcomes together.

## Integration validation status

The credential-free Chromium workflow, unit suite and production build have
been exercised successfully. The AI suite currently reaches the model call
but cannot be validated until provider credentials are configured; the
observed error is `MODEL_PROVIDER_FAILED: Unauthenticated request to AI Gateway`.
Do not treat the AI workflow as verified until it passes with live model calls.
