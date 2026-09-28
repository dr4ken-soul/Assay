# Assay — App Blueprint

## Product Summary

Assay is a blind trial bench for LLM users. A user pastes a real workload, picks the models already available to them on Anna, and Assay runs the workload across every model in parallel. Model names are stripped and shuffled before anything is displayed. When the run finishes, Assay returns a blind verdict: rubric scores, token cost, latency and a semantic comparison across anonymised outputs. Only after the user has read the anonymised results does Assay lift the blind and reveal which model earned which column. Every verdict the user crowns feeds a personal routing policy that can be exported as a default, fallback and budget rule.

Built for the Anna AI App Builder Program (DoraHacks hackathon 2349), Founding Builder cohort. Qualification requires at least 200 Qualified App MAU in one calendar month before 30 November 2026. The DoraHacks BUIDL submission closes 30 September 2026 at 15:59.

An assay is the test applied to a substance to determine its quality and purity. That is the entire product in one word.

---

## Program Context

- The final submission must be an approved, published Anna Marketplace App with an interactive UI and working backend. A repo, demo video or pitch deck alone is not eligible.
- A Qualified App Run must execute the declared primary function and return a meaningful, non-trivial result. For Assay the declared primary function is: run a blind trial and return a verdict. Opening the app, viewing history or editing policy does not count.
- Usage counts whether the user spends free Anna credits, paid credits or BYOK keys.
- App Review rejects thin chatbot wrappers and clones. Assay's core value depends entirely on AI execution and blind comparison, which satisfies the AI-native requirement by construction.
- Anti-sybil rules ban app splitting and cloned apps. Assay ships as one app with one primary function.
- Monthly maintenance activity is required to keep grants flowing. The routing policy and trial history features give Assay a natural improvement cadence.

---

## Market Context

**Who this is for:**

1. BYOK power users on Anna who already hold keys for two or more providers and currently choose between models on vibes, marketing or stale leaderboard folklore
2. Agent and workflow builders who ship prompts to production and need evidence for which model their specific task should route to
3. Anyone watching their credit burn who suspects a cheaper model would do, but has no way to prove it on their own work

**What they currently use:** provider consoles one at a time, public leaderboards built on other people's prompts, vibes-based model selection, or homegrown eval scripts that never become products.

**Why they switch:** the benchmark that matters is the user's own workload. Assay is the only place where that workload runs across all their models at once, scored blind, with cost and latency measured server side.

**Revenue reality for this program:** income is the Anna monthly grant ladder (200 MAU is Tier E at 80 USD in September with the Launch Boost, 50 USD per month standard afterwards, climbing to 5,000 USD per month at 20,000 MAU). The app itself is free to run, spending the user's own credits or keys.

---

## MVP Feature Set

### Feature 1: Blind Trial Execution

**User story:** As a model user I want my real workload run across several models at once with the names hidden, so that my reading of the outputs is not biased by brand, price or reputation.

**How it works:** The UI collects a workload (task text plus optional input) and a model roster. The Executa tool shuffles the roster, assigns letters MODEL A, MODEL B and so on, and holds the letter-to-model mapping only in the trial record. It executes the workload against every roster model in parallel with Promise.allSettled, measuring wall-clock latency and token usage per call. Model calls use the user's injected BYOK credentials where present and Anna sampling otherwise. A failed call marks that column FAILED and excludes it from the verdict. No substitution, no retry theatre.

**Acceptance criteria:** during a run, no model name appears anywhere in the UI, the tool's logs or any error message. A roster of three models where one key is invalid returns two scored columns and one FAILED column, plus an inline error naming only the letter.

**Complexity:** Medium

### Feature 2: Verdict Engine

**User story:** As a user I want a scored, comparable verdict across the anonymised outputs, so I can act on evidence instead of impressions.

**How it works:** After the run, the tool sends the original task plus all anonymised outputs to Anna's sampling endpoint with a fixed examination rubric. The judge scores each output from 0 to 5 on correctness, instruction fit, concision, tone and grounding, and flags pairwise agreement between outputs so the user can see where models diverge. Cost is computed from token usage against a bundled, versioned price table. The verdict assembles quality scores, cost, latency, value ratio and divergence notes into one report. The judge prompt is included verbatim in the Anna Integration Detail section below.

**Acceptance criteria:** the verdict returns strict JSON that validates against the verdict schema. The judge never receives model names. Re-running the same trial twice produces scores within one rubric point of each other.

**Complexity:** High

### Feature 3: Unblind and Preference Capture

**User story:** As a user I want to commit to a winner after reading the anonymised results, so my choice stays unbiased and feeds my history.

**How it works:** The verdict view shows anonymised columns only. The user crowns one winner, or explicitly crowns a tie. Only then does the UI call the unblind method, which returns the letter-to-model mapping, and the columns flip to real names with a staggered reveal. The crown, the revealed names, the scores, cost and latency are written to the user's Anna Persistent Storage as a trial record.

**Acceptance criteria:** crowning before unblinding is possible, crowning after unblinding is not, the crown button disables once used. The trial record lands in storage within one second of the crown.

**Complexity:** Low

### Feature 4: Routing Policy

**User story:** As a user I want my crowns to compound into a routing policy, so each trial permanently changes how I pick models.

**How it works:** Every crown updates exponential moving averages per model: quality share, cost efficiency, latency reliability, each seeded from the verdict data. The policy screen shows the resulting ranking and lets the user lock a default model, a fallback model and a budget model per task type (draft, rewrite, extract, code, analyse). The policy exports as JSON for use in the user's own agents and scripts.

**Acceptance criteria:** after five crowns of the same model, its policy rank is first. Exported JSON round-trips: importing it reproduces the same ranking. Policy updates never delete trial history.

**Complexity:** Medium

**What makes this the one that matters for the program:** the trial is a genuine Qualified App Run with real credit or BYOK spend behind it, it is useful the first time and every time a new workload appears, and the policy gives users a reason to return monthly. Recurrence is what the MAU ladder pays for.

---

## What Is Not Being Built in MVP

- Live proxy routing of production traffic. Assay recommends, it does not intercept the user's other apps
- Team or shared policies, per-user namespaces only
- A public leaderboard of model performance. Individual verdicts stay private, an anonymised aggregate may come later
- A canned benchmark library. The user's workload is the benchmark
- Custom judge rubrics. One fixed rubric in MVP, editable weights afterwards
- Automated scheduling of recurring trials
- Embedding-based workload dedupe, the host embedding API is a natural later addition

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| App frame | Anna App, manifest schema 2 or higher | The program requires a published Marketplace App with an interactive UI |
| UI bundle | React 18, TypeScript, Tailwind CSS, motion/react, bundled SPA | Anna renders the bundle in a sandboxed window with host API access |
| Tool | Executa plugin, Node.js with TypeScript over JSON-RPC 2.0 on stdio | Anna's extension system, first-class in the docs and examples |
| Model calls | BYOK credentials injected by Anna, plus host sampling for keyless models | Counts fully toward MAU under the credits and BYOK policy |
| Judge | Anna sampling with a fixed rubric prompt | No extra key burden, billed by Anna, names never sent |
| Storage | Anna Persistent Storage, per-user KV | Server-side records the program itself uses for verification, no external DB |
| Landing page | Next.js 14 App Router, TypeScript, Tailwind, motion/react, Vercel | Distribution surface for the MAU push |
| Database | None | Anna owns accounts, execution records and per-user storage |
| Analytics | Anna's server-side execution records | The program's own source of truth for MAU |

---

## Anna Integration Detail

### Manifest sketch

The manifest declares one bundled Executa tool, one UI bundle and the host API grants the UI needs. Field names follow the schema 2 UI manifest reference, exact values are confirmed against the live docs during the build.

```json
{
  "name": "assay",
  "displayName": "Assay",
  "description": "Blind trials for your model stack",
  "version": "0.1.0",
  "executas": [
    { "kind": "tool", "name": "assay-core", "runtime": "node" }
  ],
  "ui": {
    "bundle": "dist/",
    "views": ["bench", "history", "policy"],
    "host_api": ["tools", "storage"]
  }
}
```

### Tool method surface

| Method | Params | Returns | Notes |
|---|---|---|---|
| `roster.list` | none | available models with key status | Key status is boolean, never the key |
| `trial.start` | workload text, roster ids | trial id, letters in run order | Anonymises before any call is made |
| `trial.status` | trial id | per-letter state, live timers | Polled by the UI every 500ms |
| `trial.verdict` | trial id | full verdict report | Judge via sampling, schema below |
| `trial.unblind` | trial id | letter-to-model mapping | Refuses if the trial has no verdict |
| `trial.crown` | trial id, letter or tie | confirmation, updated policy preview | Writes the trial record and updates policy |
| `history.list` | page cursor | trial summaries | From APS, newest first |
| `history.get` | trial id | full record, post-unblind | |
| `policy.get` | none | weights, ranks, locks, version | |
| `policy.setLock` | task type, default, fallback, budget | updated policy | |
| `policy.export` | none | policy JSON as a string | UI copies to clipboard |

### Judge prompt, verbatim

```
You are a blind examiner. You will receive one task and several anonymised
candidate outputs labelled MODEL A, MODEL B and so on. Score each output
from 0 to 5 on five axes: correctness, instruction fit, concision, tone and
grounding. Penalise padding, invented facts and ignored constraints. For each
pair of outputs note in one short line where they substantively disagree.
You must not speculate about which real model produced which output. Reply
with strict JSON only, matching:

{
  "scores": { "MODEL A": { "correctness": 0, "instructionFit": 0,
    "concision": 0, "tone": 0, "grounding": 0 } },
  "divergences": [ { "between": ["MODEL A", "MODEL B"], "note": "" } ],
  "examinerNotes": ""
}
```

### Trial run sequence

```
trial.start    shuffle roster, assign letters, persist mapping
parallel       one model call per letter, latency and tokens measured
settle         FAILED columns excluded, no substitution
trial.verdict  judge via sampling, cost from token table, assemble report
trial.crown    user picks winner blind, record written to APS
trial.unblind  mapping revealed, policy EMA updated from the record
```

### APS data model

```
kv: trials/{id}        TrialRecord
kv: policy/current     PolicyRecord
kv: policy/version     integer
```

```typescript
interface TrialRecord {
  id: string
  createdAt: string
  workload: string
  rosterLetters: Record<string, ModelId>
  results: Record<string, {
    state: 'ok' | 'failed'
    latencyMs: number
    tokensIn: number
    tokensOut: number
    costUsd: number
    output: string
  }>
  verdict: VerdictReport
  crown: { letter: string | 'tie'; crownedAt: string } | null
}

interface VerdictReport {
  scores: Record<string, RubricScores>
  costUsd: Record<string, number>
  latencyMs: Record<string, number>
  valueRatio: Record<string, number>
  divergences: Array<{ between: [string, string]; note: string }>
  examinerNotes: string
}

interface PolicyRecord {
  ema: Record<ModelId, { quality: number; costEfficiency: number; latencyReliability: number }>
  rank: ModelId[]
  locks: Record<TaskType, { default: ModelId | null; fallback: ModelId | null; budget: ModelId | null }>
  version: number
  crownsRecorded: number
}
```

---

## Qualified Run and Anti-Gaming Design

- The declared primary function in the listing is: run a blind trial and return a verdict. Every other screen is secondary.
- A trial with a FAILED roster still returns a verdict over the surviving columns, it is a real result, not a failed run.
- The tool rate-limits trials to six per user per hour. Runs are expensive by nature, there is no reason to spin them.
- No rewards, credits or gamified incentives for running trials. The product is the incentive.
- The verdict anatomy section of the landing page renders only real trial data from Assay's own recorded trials, with the workload published alongside it.

---

## App Review Compliance Mapping

| Review criterion | How Assay satisfies it |
|---|---|
| Complete app experience | Three views, full run flow, loading, empty and error states, working backend |
| AI-native core | The product is meaningless without model execution and blind scoring |
| Functional completeness | Declared task, blind trial to verdict, is performed end to end |
| Distinctiveness | No blind multi-model adjudicator exists on the Anna Marketplace at time of writing, verified against the listing before submission |
| Reliability | Failed providers degrade to FAILED columns, Anna's own execution records back the run |

---

## App Routes and Views

**Inside Anna:** bench (default), history, policy. Single window, tabbed header, per the FRONTEND_SPEC app interior section.

**Landing page:** `/` only, plus anchor targets for the trial method, verdict anatomy and policy sections. Hosted separately on Vercel, linked from the Marketplace listing and social posts.

---

## Landing Page Section Map

1. Hero, top-left statement with bottom-right live trial tile
2. Statement, typographic
3. The method, four moves with specimen art and a scroll-drawn connector
4. Verdict anatomy, asymmetric bento over real trial data
5. Metrics with the bench knoll strip
6. Policy with the beam balance art and policy card
7. Final CTA with the gauge macro
8. Footer

Full class-level detail lives in FRONTEND_SPEC.md. This list is the map, not the territory.

---

## Build Priority

1. Executa tool: roster, trial execution, anonymisation, verdict assembly
2. UI bundle: bench screen end to end, run to unblind
3. History and policy screens on APS
4. Local trial passes with real keys through `anna-app dev`
5. Marketplace listing, review and publish
6. Landing page per FRONTEND_SPEC.md, with at least one real trial recorded for the anatomy section
7. DoraHacks BUIDL submission before 30 September 2026 15:59
8. MAU push through Q4: Discord, X, communities, iterate from feedback

---

## Hackathon Deliverables Checklist

- Approved and published Anna Marketplace App
- Public GitHub repository with a complete README
- DoraHacks BUIDL submitted before 30 September 2026 15:59
- Demo video, under 90 seconds, full flow from workload to unblind
- X post with the demo video and the marketplace listing link
- Presence in the Builder Discord
- 200 Qualified App MAU in one calendar month before 30 November 2026
- One meaningful maintenance improvement shipped every month afterwards
