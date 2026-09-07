# Real iPhone Safari QA

This suite targets BrowserStack Automate real iOS Safari. Desktop WebKit and device emulation do not count as a pass.

Required environment variables:

- `BROWSERSTACK_USERNAME`
- `BROWSERSTACK_ACCESS_KEY`
- either `SITES_QA_BYPASS_TOKEN`, or `QA_EMAIL` and `QA_PASSWORD`

Optional:

- `QA_BASE_URL` (defaults to the v116 production URL)
- `QA_RELAY_PROJECT_TITLE` (selects a known participant project)
- `BUILD_NUMBER`

Run `pnpm test:iphone:real`. Artifacts are written below `artifacts/browserstack/`; BrowserStack also records the real-device session video and network logs.

The suite validates UI and observable browser behavior. Recording loudness, clipping/distortion, BGM curve naturalness, and voice quality always remain manual audio QA.
