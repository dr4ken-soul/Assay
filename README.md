# Assay

**The blind trial for your model stack.**

Assay runs your real workload across the models you already pay for, strips the names, and returns a blind verdict on quality, cost and latency.

Paste a task, pick two or more models, press run. Every model answers in parallel as `MODEL A`, `MODEL B`, `MODEL C`. A blind examiner scores the anonymised outputs on five axes. Token cost and latency are measured server side. You crown a winner while blind, and only then does Assay lift the blind and show which model earned which column. Every crown feeds a routing policy that exports as plain JSON.

---

## Contents

- [What it does](#what-it-does)
- [How the blind holds](#how-the-blind-holds)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Running the tests](#running-the-tests)
- [Publishing to Anna](#publishing-to-anna)
- [Binding the landing page to a real trial](#binding-the-landing-page-to-a-real-trial)
- [Deploying the landing page](#deploying-the-landing-page)
- [What is deliberately not built](#what-is-deliberately-not-built)
- [Programme checklist](#programme-checklist)
- [Deviations from the spec, and why](#deviations-from-the-spec-and-why)

---

## What it does

Assay answers one question honestly: **which model should this specific workload route to?**

Public leaderboards test other people's prompts. A model that tops a chart can still be the wrong tool for your prompt, because the chart measured a task you do not have. Assay takes the task you actually run and puts every model you have a key for through it, blind.

**The primary function is: run a blind trial and return a verdict.** Everything else in the app is secondary.

### The four features

1. **Blind trial execution.** The roster is shuffled with a cryptographic shuffle, letters are assigned in run order, and the letter-to-model mapping is written to Anna Persistent Storage *before the first call is made*. A crash mid-run can never leak a name through ordering. Every column runs in parallel. Latency and token counts are measured. A provider failure becomes a `FAILED` column carrying an error class and an operator hint, never a substitution and never a retry.

2. **Verdict engine.** The anonymised outputs and the task text go to Anna's sampling endpoint with a fixed rubric prompt. The examiner scores correctness, instruction fit, concision, tone and grounding from 0 to 5, and notes where outputs substantively disagree. Cost is computed from measured tokens against a versioned price table. Where a price is unknown, cost is `null` and the column reads `ANNA CREDITS` rather than being given a made-up figure.

3. **Unblind and preference capture.** The verdict view shows letters only. You crown a winner, or explicitly crown a tie. Only then does the tool release the mapping. The trial record lands in APS within the same call.

4. **Routing policy.** Every crown folds into three per-model exponential moving averages: quality share, cost efficiency and latency reliability. Models that stop appearing decay. You can lock a default, a fallback and a budget model for each of `draft`, `rewrite`, `extract`, `code` and `analyse`. The whole policy exports as JSON.

---

## How the blind holds

This is the part of the product that is easy to get wrong, so it is enforced in four independent places.

| Guarantee | Where it is enforced |
|---|---|
| No model name in the DOM while running or in the verdict | `app/ui/test/blind.test.tsx`, nine cases, run by `npm run blind-check` |
| No model name hardcoded in a component | `app/ui/scripts/blind-check.mjs`, a static scan of the source tree |
| No model name in the judge's input | `app/executas/assay-core/src/judge.ts`, the payload is string-searched for every roster id and label before it leaves the process |
| No model name in any log line or error message | `app/executas/assay-core/src/rpc.ts`, the logger takes letters and ids only |

Two design decisions came out of writing those tests:

**The bench states do not overlap.** The four bench states swap hard rather than running through a presence boundary. A presence boundary keeps the outgoing section mounted through its exit, and the outgoing setup section carries the roster chips, so a model name would sit in the DOM while the trial runs. One state is in the DOM at a time.

**The judge payload is scrubbed, not trusted.** Model outputs sometimes self-identify. Rather than aborting the whole verdict, every roster name found in the payload is replaced with `[REDACTED]` and the count is carried into the verdict's examiner notes, so the redaction is visible rather than silent. The judge provably never receives a name.

---

## Architecture

```
  ┌──────────────────────────────────────────────┐
  │  Anna window, sandboxed iframe               │
  │                                              │
  │  React 18 SPA, three views                   │
  │  bench · ledger · policy                     │
  │      │                                       │
  │      │ every call goes through lib/host.ts   │
  │      ▼                                       │
  │  anna.tools.invoke                           │
  └──────┼───────────────────────────────────────┘
         │  ACL: manifest.ui.host_api.tools
         ▼
  ┌──────────────────────────────────────────────┐
  │  Executa, assay-core, Node.js + TypeScript   │
  │  JSON-RPC 2.0 over stdio                     │
  │                                              │
  │  index   dispatch, 11 methods                │
  │  roster  model discovery, boolean key status │
  │  trial   shuffle, run in parallel, timing    │
  │  judge   blind examination, scrub, validate  │
  │  cost    versioned price table               │
  │  policy  EMA weights, locks, export          │
  │  store   APS wrapper and rate limit          │
  │  rpc     stdio transport, reverse RPC        │
  │  types   the shared JSON contract            │
  └──────┬────────────────────┬──────────────────┘
         │ reverse RPC        │ reverse RPC
         │ sampling/          │ storage/*
         │ createMessage      │
         ▼                    ▼
   provider APIs        Anna Persistent Storage
   with BYOK keys       trials/ · policy/ · ratelimit/
```

### The eleven tool methods

| Method | What it does |
|---|---|
| `roster_list` | Models available to this user, each with a boolean `hasKey`. Never key material. |
| `trial_start` | Shuffle, assign letters, persist the mapping, start the parallel run, return the trial id. |
| `trial_status` | Per-letter state and live timers. Never the mapping. |
| `trial_verdict` | The blind examiner, then cost, latency and value assembly. |
| `trial_crown` | Records the blind choice, writes the ledger, folds the crown into the policy. |
| `trial_unblind` | Releases the mapping. Refuses before a crown. |
| `history_list` | Ledger summaries, newest first. |
| `history_get` | One full record. Names only once unblinded. |
| `policy_get` | Weights, rank, locks, version. |
| `policy_set_lock` | One lock for one task lane. |
| `policy_export` | The policy as a JSON string. |

### Where the models come from

Two sources, and the bench says which is which on every chip.

- **BYOK.** Eight provider integrations declared as optional credentials in the tool manifest. A provider's models appear only when Anna has injected that provider's key. The key is read from the request-scoped invoke context, used in a header, and dropped. It is never logged, returned, cached between requests, or written to storage.
- **Anna credits.** Three sampling lanes: a quality lane, a speed lane and a cost lane. Each is a soft routing preference handed to the host's selector. The host resolves a concrete model, which is recorded in the trial and revealed only after the unblind. These lanes have no list price, so their cost reads `ANNA CREDITS` and their value ratio is `null`. That is the honest answer, not a zero.

### Keys and claims

| Claim | How it is met |
|---|---|
| Blind until the crown | Letters are assigned after a cryptographic shuffle, mapping persisted before the first call, four independent tests. |
| Cost measured, not subscription | Token counts come from the provider response, cost from `cost.ts`, and every verdict stamps `PRICE_TABLE_VERSION`. |
| Token counts never faked | Provider-reported where available, character-estimated where not, and the estimate is flagged in the record and surfaced in the ledger. |
| No fabricated verdicts | A failed column is `FAILED`. An examiner reply that is not valid JSON against the schema is rejected, re-asked once, then surfaced as an error. |
| Runaway protection | Six trials per user per hour, held in APS so it survives a plugin restart. |
| Secrets never touched | Credentials arrive only through injection. The tool never reads a key from disk or the environment in production, and never writes one. |

### Security and privacy

- Workload text goes to the providers on trial and to Anna's sampling endpoint. Nothing else.
- Trials, outputs and the policy live only in the user's own APS namespace. Keys are namespaced by the platform, so no user identifier ever appears in a key.
- The bundle holds no `llm` or `chat` grant. It cannot call a model directly; the tool does all the work.
- The price table is data, not a secret, and the app ships with no secrets at all.

---

## Repository layout

```
assay/
├── app/                            the Anna App
│   ├── manifest.json               schema 2, one tool, one bundle
│   ├── app.json                    store listing metadata
│   ├── executas/
│   │   └── assay-core/             the tool
│   │       ├── executa.json        tool_id and launch command
│   │       ├── src/                index roster trial judge cost policy store rpc types
│   │       ├── dist/               committed, the harness runs it directly
│   │       ├── test/               16 unit tests
│   │       └── scripts/smoke.mjs   protocol smoke test
│   └── ui/                         the SPA bundle
│       ├── src/views/              Bench History Policy
│       ├── src/components/         Icon Primitives Skeleton
│       ├── src/lib/                host types format motion
│       ├── src/styles/globals.css  the design system
│       ├── test/                   37 tests, 9 of them the blind check
│       ├── scripts/blind-check.mjs
│       └── dist/                   built, uploaded through the bundle pipeline
├── web/                            the landing page
│   ├── src/app/                    layout and page
│   ├── src/components/
│   │   ├── canvas/CalibrationField.tsx
│   │   ├── layout/MorphNav.tsx
│   │   ├── primitives/
│   │   └── sections/               Hero Statement Method Anatomy Metrics Policy FinalCta Footer
│   ├── src/data/corpus.ts          the recorded trial corpus
│   ├── src/data/measures.ts        every number on the page, derived
│   └── public/images/              the Assay Bench series, seven coded assets
├── APP_BLUEPRINT.md
├── BUILD_GUIDE.md
├── CLAUDE.md
├── FRONTEND_SPEC.md
├── MARKETING.md
└── README.md
```

---

## Getting started

### There is no `.env` file, and you should not create one

This trips people up, so it is stated plainly: **this app has zero secrets and reads no environment variables.**

`.env.example` in the repository root is a comment-only file. It documents which credentials exist so you know what to go and set up in Anna, and every line of it is commented out. Do not fill it in. Do not create a `.env`.

Model API keys are entered **once, by you, in Anna's own credential UI**. Anna stores them encrypted at rest and injects the value into each tool call, request scoped. The plugin reads them from that injection and nowhere else:

```
you paste a key into Anna  ->  Anna stores it encrypted
                            ->  you run a trial
                            ->  Anna injects the key into that one invoke
                            ->  the plugin uses it in an HTTP header
                            ->  the plugin drops it
```

The plugin never reads `process.env`, never caches a key between requests, never writes one to storage and never logs one. That is not a policy note, it is a property of the code: `grep process.env app/executas/assay-core/src` returns nothing.

If you ever find yourself wanting to put a key in a file, you have found a bug, not a missing step.

### Prerequisites

```bash
node --version    # 18.17 or higher, 22+ recommended
npm --version     # 9 or higher
git --version

# one-time, for the dev harness
curl -LsSf https://astral.sh/uv/install.sh | sh   # Windows: winget install astral-sh.uv
npm i -g @anna-ai/cli
anna-app doctor
```

### Build everything

```bash
# the tool
cd app/executas/assay-core
npm install
npm run build        # dist/ is committed, so this is only needed after a source change
npm test
npm run smoke

# the bundle
cd ../../ui
npm install
npm run build

# the landing page
cd ../../web
npm install
npm run build
```

### Run the app locally

```bash
cd app
anna-app dev --bundle ui/dist
```

Open `http://localhost:5180/`. The harness runs the production dispatcher, spawns the tool over stdio, and mounts your bundle in an iframe. The RPC log in the sidebar shows every host call the bundle makes.

Useful flags:

| Flag | Why |
|---|---|
| `--storage aps` | Real Anna Persistent Storage instead of in-memory. Needs `anna-app login`. |
| `--llm` | Wire the tool's sampling to a real model. Needs a PAT. |
| `--no-llm` | Offline. The bench renders, the roster is empty, trials refuse. |
| `--mock-llm <fixture>` | Canned sampling replies, offline and deterministic. |
| `--mobile` | Check the mobile layout. |

### Run the landing page

```bash
cd web
npm run dev         # http://localhost:3000
```

---

## Running the tests

```bash
# 16 tool tests: anonymisation, judge scrubbing, strict JSON, rate limit, policy, cost
cd app/executas/assay-core && npm test

# protocol smoke: v2 handshake, describe, health, unknown method, no credential echo
cd app/executas/assay-core && npm run smoke

# 37 bundle tests, including the nine blind cases and the tool id contract
cd app/ui && npm test

# the blind check on its own: static scan plus the DOM suite
cd app/ui && npm run blind-check

# the manifest against the real platform schema, including the ACL grep
cd app && anna-app validate --strict --bundle ui/dist
```

`contract.test.ts` reads the tool's own `describe` output and asserts the bundle calls the same eleven method names, the same task lanes and the same lock slots, and that the minted tool id agrees across all four files that carry it. If either side drifts, the test fails rather than a user's trial.

---

## Publishing to Anna

### The order matters, and the Console encourages the wrong one

The Developer Console at https://anna.partners/developer has a big **New App** button, and it is tempting to press it. **Not yet.** Your app manifest references a `tool_id`, and both the validator and the publish precheck resolve it against the **live Executa catalogue**. If the tool does not exist yet, the app version will not validate and the submit-review precheck will fail.

The tool comes first, then the app.

| # | Do this | Where |
|---|---|---|
| 1 | Activate the developer profile | done, you are here |
| 2 | `anna-app login`, then `anna-app account set-handle <handle>` | terminal, the handle is **required before your first app** |
| 3 | Create the Executa and **Mint** its `tool_id` | https://anna.partners/executa |
| 4 | Wire the minted id into the repo | `node scripts/set-tool-id.mjs apply --tool <id>` |
| 5 | Publish the Executa, visibility `private` or `app_bundled` | https://anna.partners/executa |
| 6 | Create and version the App | `anna-app apps publish`, or the Console |
| 7 | Fill the listing, then submit for review | Console, Listing and Versions tabs |

Two things the mint step insists on that catch people out: the **Tool ID field is read-only and the Create button stays disabled until you press the Mint button**, and a draft that is never committed **expires after 24 hours**. Mint early, and even if you walk away the id is yours for a day.

Do not flip the tool to `public` yet. Set it `private` while you test, or `app_bundled` if it is only ever meant to ship inside Assay. The docs are explicit that promoting too early is the common cause of a failed install leaving a dead tool behind.

### 1. Swap the development tool id

The project ships with `tool-dev-assay`, the synthetic id `anna-app init` generates so the app runs offline. Anna mints the real one for your account, and the **same string has to appear in four places**. Forgetting any one of them produces a Stopped card or a silent `tools.invoke` timeout, with no error at build time.

Do not hand-edit the four files. Use the script:

```bash
cd app

node scripts/set-tool-id.mjs status
node scripts/set-tool-id.mjs apply --tool tool-<handle>-assay-<uniq>
node scripts/set-tool-id.mjs status
```

The four anchors it writes:

| # | File | Position |
|---|---|---|
| 1 | `app/executas/assay-core/executa.json` | `tool_id`, read by the CLI **and by the plugin itself at startup** |
| 2 | `app/manifest.json` | `required_executas[0].tool_id` |
| 3 | `app/manifest.json` | `ui.host_api.tools[0]`, with its `required:` prefix |
| 4 | `app/ui/src/lib/host.ts` | the `TOOL_ID` constant the bundle invokes through |

The platform tracks identity by the minted `tool_id` and no longer reads a self-reported `describe.name` for that purpose, so baking the id into the plugin's own manifest is optional rather than required. It is done here anyway: it matches the reference example, and it makes the harness log name the tool it is running. `app/ui/test/contract.test.ts` asserts all four agree, which turns the silent failure into a failed test suite.

To put the placeholder back before committing a change, `node scripts/set-tool-id.mjs reset`.

### 2. Log in and set your handle

```bash
anna-app login --host https://anna.partners
anna-app account set-handle <your-handle>
```

### 3. Validate and push

```bash
cd app/executas/assay-core && npm run build   # the plugin reads its id at startup
cd ../
anna-app validate --strict --bundle ui/dist
anna-app apps push --bundle-dir ui/dist
anna-app apps publish --bump patch --bundle-dir ui/dist
```

### 4. Fill the listing

The Developer Console Listing tab takes the fields in `app/app.json`. The one that matters most:

> **Declared primary function:** run a blind trial and return a verdict.

That sentence is what a Qualified App Run is measured against. Copy it into the listing verbatim.

### 5. Submit for review

```bash
anna-app apps submit-review
```

Review normally completes in three to five business days. After approval, install the app from a fresh Anna account and run one full trial: workload, run, verdict, crown, reveal, policy export.

---

## Binding the landing page to a real trial

The anatomy and metrics sections render from recorded data only, and the repository ships with an **empty corpus on purpose**. Nothing on the page is invented, and the sections that would show a number show an honest empty state instead.

This is the one thing that needs your own account and your own keys. To bind it:

1. Install Assay from the Marketplace.
2. Run one trial on a workload you are happy to publish in full.
3. Crown a winner and lift the blind.
4. Copy the trial record out of the app window.
5. Paste it into `web/src/data/corpus.ts` and set `bound: true`:

```ts
export const CORPUS: Corpus = {
  bound: true,
  trials: [
    {
      id: 't_...',
      createdAt: '2026-09-28T10:00:00.000Z',
      workload: 'The exact task you ran, published in full.',
      revealed: [
        { letter: 'MODEL A', label: '...', modelId: '...', source: 'byok' },
        { letter: 'MODEL B', label: '...', modelId: '...', source: 'byok' },
      ],
      scores: { 'MODEL A': { correctness: 4, instructionFit: 5, concision: 4, tone: 4, grounding: 4 } },
      costUsd: { 'MODEL A': 0.0041, 'MODEL B': 0.0116 },
      latencyMs: { 'MODEL A': 3900, 'MODEL B': 7200 },
      failedCount: 0,
      crowned: 'MODEL A',
      priceTableVersion: '2026-09-28.v1',
    },
  ],
}
```

6. Rebuild and deploy.

`web/src/data/measures.ts` derives every figure from that record. If a measure cannot be derived, it comes back `null` and **the card is not rendered**. That is the rule, and it is why the anatomy grid is two columns wide on an empty corpus and five on a bound one.

---

## Deploying the landing page

```bash
cd web
npx vercel
```

Or any Next.js host. `npm run build` produces a static page, no server runtime required.

Before deploying, replace these two lines:

- `web/src/app/layout.tsx` → `metadataBase`, currently a placeholder
- the `MARKETPLACE` link in `web/src/components/sections/Footer.tsx`, currently the platform root rather than your listing URL

---

## What is deliberately not built

Not in the MVP, and not oversights:

- Live proxy routing of production traffic. Assay recommends, it does not intercept your other apps.
- Team or shared policies. Per-user namespaces only.
- A public leaderboard. Individual verdicts stay private.
- A canned benchmark library. Your workload is the benchmark.
- Custom judge rubrics. One fixed rubric, the weights published on the landing page.
- Scheduled recurring trials.
- Embedding-based workload dedupe.

---

## Programme checklist

- [x] Complete app: three views, full run flow, loading, empty and error states, working backend
- [x] AI-native core: the product is meaningless without model execution and blind scoring
- [x] Functional completeness: declared task performed end to end
- [x] Reliability: failed providers degrade to `FAILED` columns, no substitution
- [x] Public repository with a complete README
- [ ] Anna Marketplace approval and publication
- [ ] Anna account created, developer profile activated
- [ ] Tool id minted, `anna-app apps publish` run
- [ ] Listing submitted with the declared primary function
- [ ] Installed and verified from a fresh Anna account
- [ ] Three real trials recorded, one all keys valid, one with an invalid key, one sampling only
- [ ] Harness session recorded with `anna-app dev` and the blind check in the replay
- [ ] Landing page bound to a real recorded trial
- [ ] Landing page deployed to Vercel
- [ ] Demo video recorded, under 90 seconds, workload to unblind
- [ ] DoraHacks BUIDL submitted before 30 September 2026 15:59
- [ ] X post with the video and the marketplace listing
- [ ] Builder Discord presence
- [ ] 200 Qualified App MAU in one calendar month before 30 November 2026
- [ ] One meaningful maintenance improvement every month after qualification

Every unchecked box needs an Anna account, a minted tool id, real model keys or a human with a camera. Everything that can be built and verified from this repository is done.

### The demo video, shot for shot

85 seconds, per `MARKETING.md`:

1. Open the bench, paste a real workload. 10s
2. Pick three models from the roster chips. 8s
3. Run. Three anonymised columns streaming, timers and cost accruing. 15s
4. Verdict lands, rubric bars fill, divergence notes visible. 15s
5. Crown a winner, blind. 8s
6. Unblind flip, crowned column revealed with the stamp. 10s
7. Cut to the policy screen, weights shifted, export copied. 12s
8. End on the wordmark over the bench. 7s

### Verdict anatomy, once the corpus is bound

A pointer down at the 38 percent cost gap, a 0.9 quality ratio, a 3.9 second verdict, a model swap you did not expect. Every one of those is a number from your own recorded trial, and the workload is published beside it.

---

## Deviations from the spec, and why

Everything the four planning documents ask for is built. Six decisions differ, each for a stated reason.

**1. The seven bench assets are coded SVG, not photography.** `FRONTEND_SPEC` 14 briefs seven photographic assets, pulled from stock or generated. This build has no image generation available and no licensed photo source, so the Assay Bench series is drawn as original SVG on the same palette: cool grey bench, ink shadows, one red indicator, no warm cream, no logos, no people. They are on-palette, deterministic, tiny, and licence-clean. Replacing them with graded photography is a drop-in swap: the files are referenced by path and the aspect ratios already match the brief.

**2. `tool_id` is the development placeholder, and a script keeps it consistent.** `tool-dev-assay` is what `anna-app init` generates so the app runs offline. The real id is minted against your account and the platform requires it in the app manifest. Rather than document four manual edits and hope, `app/scripts/set-tool-id.mjs` writes all four anchors atomically and the contract test fails the suite if they disagree. Publishing still needs your account.

**3. The anatomy and metrics sections ship unbound.** The spec is explicit that every number traces to a recorded trial and that an unbackable card is removed. With no account and no keys, no trial can be recorded from here, so the corpus is empty and the sections render their empty state. This is the spec's own rule applied honestly, not a gap. The procedure to bind it is in [Binding the landing page](#binding-the-landing-page-to-a-real-trial).

**4. The bundle is a Vite SPA, not a hand-written `bundle/app.js`.** The quickstart's minimal template uses a no-build static bundle. `FRONTEND_SPEC` 11 specifies React 18, TypeScript, Tailwind, `motion/react` and three views, which needs a real build. Vite is configured with `base: './'` so assets resolve under the versioned bundle path, and the SDK is loaded at runtime from the host origin and never bundled.

**5. The app manifest declares three views over one window.** `APP_BLUEPRINT` sketches `views: ["bench", "history", "policy"]`; `FRONTEND_SPEC` 11.1 specifies a single window with a tabbed header. Both are satisfied: three view entries so the assistant can open the ledger or the policy directly, each `single_instance` and all pointing at the same entry, with the tabbed header selecting the initial route. One window, three addressable views.

**6. Two files sit outside the documented tree.** `src/types.ts` holds the shared JSON contract, and `src/rpc.ts` holds the stdio transport with reverse-RPC demultiplexing. Both are infrastructure that the transport spec requires and neither is a view or a method, so keeping them out of the seven named modules keeps those seven readable.

---

## Licence

MIT.

Built for the Anna AI App Builder Program, Founding Builder cohort, DoraHacks hackathon 2349.
