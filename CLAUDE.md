# Assay — Agent Context

## What This Is

Assay is a blind trial bench for LLM users on Anna OS. A user pastes a real workload, picks the models already available to them, and Assay runs the workload across every model in parallel with the names stripped and shuffled. It returns a blind verdict: rubric scores, token cost, latency and divergence notes across anonymised outputs. The user crowns a winner while blind, then Assay reveals which model earned which column and folds the result into a personal routing policy that exports as JSON.

Built for the Anna AI App Builder Program, DoraHacks hackathon 2349, Founding Builder cohort. DoraHacks BUIDL closes 30 September 2026 15:59. Founding Builder qualification needs 200 Qualified App MAU in one calendar month before 30 November 2026.

---

## One-Line Pitch

Assay runs your real workload across the models you already pay for, strips the names, and returns a blind verdict on quality, cost and latency.

---

## MVP Features

1. Blind trial execution, workload runs across the roster in parallel, names shuffled to letters before any call, latency and tokens measured server side, failed providers degrade to FAILED columns with no substitution
2. Verdict engine, a blind examiner scores every output on correctness, instruction fit, concision, tone and grounding, cost computed from a versioned price table, divergence notes flag where outputs disagree
3. Unblind and preference capture, the user crowns a winner while blind, only then does the letter-to-model mapping arrive, the crowned trial is written to the user's Anna Persistent Storage
4. Routing policy, crowns shift per-model exponential moving averages, locks set default, fallback and budget models per task type, the policy exports as plain JSON

Post-MVP, not in the app yet: live proxy routing of production traffic, shared team policies, public leaderboards, canned benchmark libraries, custom rubrics, scheduled trials.

---

## Stack

| Layer | Technology |
|---|---|
| App frame | Anna App, manifest schema 2 or higher |
| UI bundle | React 18, TypeScript, Tailwind CSS, motion/react |
| Tool | Executa plugin, Node.js with TypeScript, JSON-RPC 2.0 over stdio |
| Model calls | BYOK credentials injected by Anna, plus host sampling for keyless models |
| Judge | Anna sampling with the fixed rubric prompt from APP_BLUEPRINT.md |
| Storage | Anna Persistent Storage, per-user KV |
| Landing page | Next.js 14 App Router, TypeScript, Tailwind CSS, motion/react, Vercel |
| Database | None. Anna owns accounts, execution records and per-user storage |

---

## Project Structure

```
assay/
├── app/                          the Anna App
│   ├── executas/
│   │   └── assay-core/           the tool
│   │       ├── src/
│   │       │   ├── index.ts      JSON-RPC dispatch
│   │       │   ├── roster.ts     model discovery and key status
│   │       │   ├── trial.ts      execution, anonymisation, timing
│   │       │   ├── judge.ts      sampling call, rubric, verdict assembly
│   │       │   ├── cost.ts       versioned price table
│   │       │   ├── policy.ts     EMA weights, locks, export
│   │       │   └── store.ts      APS reads and writes
│   │       └── package.json
│   ├── ui/                       the SPA bundle
│   │   ├── src/
│   │   │   ├── views/
│   │   │   │   ├── Bench.tsx     setup, running, verdict, unblind
│   │   │   │   ├── History.tsx   ledger and detail
│   │   │   │   └── Policy.tsx    ranks, locks, export
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   │   └── host.ts       host API wrappers
│   │   │   └── App.tsx           shell, tabs, view transitions
│   │   └── dist/                 built bundle, referenced by the manifest
│   ├── manifest.json
│   └── package.json
├── web/                          the landing page
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   └── CalibrationField.tsx
│   │   │   ├── layout/
│   │   │   │   └── MorphNav.tsx
│   │   │   └── sections/
│   │   │       ├── Hero.tsx
│   │   │       ├── Statement.tsx
│   │   │       ├── Method.tsx
│   │   │       ├── Anatomy.tsx
│   │   │       ├── Metrics.tsx
│   │   │       ├── Policy.tsx
│   │   │       ├── FinalCta.tsx
│   │   │       └── Footer.tsx
│   │   ├── hooks/
│   │   └── styles/
│   │       └── globals.css
│   ├── public/
│   │   └── images/               bench series assets, see FRONTEND_SPEC 14
│   └── package.json
├── APP_BLUEPRINT.md
├── FRONTEND_SPEC.md
├── BUILD_GUIDE.md
├── MARKETING.md
└── README.md
```

---

## Design System

All seven gates plus the art system confirmed. Do not deviate from any value below.

**Aesthetic:** Bento grid operational
**Identity fingerprint:** top-left lead with bottom-right support / Swiss rational / pristine light clinical bench / technical grid and dot field / front-loaded / editorial reveal
**Dials:** DESIGN_VARIANCE 6, MOTION_INTENSITY 4, VISUAL_DENSITY 7

**Fonts:**

```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&display=swap');
```

- Display: Satoshi 900, headlines only
- Body: Satoshi 400 and 500
- Mono: Fragment Mono 400, single weight, all data, labels and metrics. Mono emphasis comes from case and colour, never synthetic bold

**Colour palette:**

```css
--bg-primary:     #edf0ec;
--bg-secondary:   #e2e6e1;
--bg-surface:     #f7f9f5;
--bg-elevated:    #fdfefb;
--accent:         #d3301f;
--accent-hover:   #e8482f;
--accent-glow:    rgba(211, 48, 31, 0.08);
--text-primary:   #141814;
--text-secondary: #4a524c;
--text-muted:     #87918a;
--border-subtle:  rgba(20, 24, 20, 0.07);
--border-default: rgba(20, 24, 20, 0.13);
--success:        #1e7a4a;
--error:          #b3261e;
```

**Nav:** A2 scroll-morph pill on the landing page. Full transparent bar at the top of the hero, collapses to a centred floating pill past 80px of scroll. Tabbed header inside the app.

**CalibrationField:** the landing page's one ambient system, coded 2D canvas, never sourced. Fine measurement grid, a red sweep line travelling the viewport every 14s with a live CAL readout, top ruler ticks. Opacity by section density: 0.55 hero and final CTA, 0.35 sparse, 0.15 dense. Full spec in FRONTEND_SPEC.md 1.4.

**Art system:** the Assay Bench series, precision instrument imagery on the cool bench, one red indicator, never in the hero. Reference anchors are the three approved samples in `art-direction/`. Dual sourcing: pull keywords or generate to match, nothing ships ungraded.

**Landing sections, in order:** Hero, Statement, Method, Anatomy, Metrics, Policy, Final CTA, Footer. Full class-level detail in FRONTEND_SPEC.md, this list is the map, not the territory.

---

## Logo and Favicon

Neither exists yet. Leave both as plain comment slots:

```tsx
{/* Logo slot: replace with public/logo.svg once provided */}
```

```html
<!-- Favicon slot: replace with public/favicon.ico once provided -->
```

Never substitute a hardcoded placeholder, an AI-generated mark or an emoji in either slot.

---

## Anna Integration

The app is a schema 2 Anna App: one bundled Executa tool, one SPA UI bundle. The UI never calls a model directly, it calls the tool through the host API and the tool does the work.

```
trial.start     shuffle roster, assign letters, persist mapping
parallel        one model call per letter, latency and tokens measured
settle          FAILED columns excluded, never substituted
trial.verdict   judge via sampling, cost from the token table
trial.crown     user picks blind, record written to APS
trial.unblind   mapping revealed, policy EMA updated
```

Full method table, APS schema and the verbatim judge prompt live in APP_BLUEPRINT.md. Confirm exact manifest field names and host API surfaces against the live developer docs at build time, they are listed in BUILD_GUIDE.md Phase 0.

---

## Code Rules (follow without exception)

**TypeScript and React:**
- camelCase for all variables and functions
- JSDoc comments on every function and custom hook
- CSS variables from the design system used directly, never hardcoded hex in component files
- CSS class hover states only, no inline onMouseEnter or onMouseLeave style mutation
- Framer Motion imported from `motion/react`
- Blur-in as the default entrance, filter blur plus opacity plus translate
- Every whileInView uses `viewport={{ once: false, amount: 0.1 }}`, zero exceptions
- Skeleton shimmer for every loading state, never spinners
- Never use localStorage or sessionStorage, the app persists through APS, the landing page persists nothing
- Never use JetBrains Mono, the mono is Fragment Mono and it has one weight
- Double bezel on major cards and the hero tile, inner radius always smaller than outer
- No `h-screen`, use `min-h-[100dvh]`

**Icons:** inline SVG or Google Material Icons only. No emoji as UI elements, no third-party icon libraries.

**Writing rules, all copy, labels, comments, JSDoc, README, posts:**
- British English throughout
- No em dashes anywhere
- Periods only when necessary, commas only when necessary
- Short direct sentences, no filler
- Banned words: elevate, seamless, unleash, unlock, next-gen, empower, revolutionise, transform, cutting-edge, supercharge, streamline, leverage
- No lorem ipsum, no placeholder copy, every string is final text
- No fake data, every number on the landing page traces to a recorded trial

---

## Never Do These

- Never display a model name before the unblind step, not in the UI, not in logs, not in error messages
- Never fabricate, smooth or estimate a verdict. A failed call is a FAILED column
- Never store workloads or outputs anywhere but the user's own APS namespace
- Never send workload text to any service other than the providers on trial and Anna's sampling endpoint
- Never touch an API key directly, credentials arrive only through Anna's credential injection
- Never pay or reward users for running trials, the program's anti-cheat rules exclude that traffic
- Never let the landing page show a number the trial corpus cannot back, remove the card instead

---

## Hackathon Checklist

- Project name: Assay
- Program: Anna AI App Builder Program, DoraHacks hackathon 2349
- DoraHacks BUIDL submitted before 30 September 2026 15:59
- Anna Marketplace approval and publication, complete app, interactive UI, working backend
- 200 Qualified App MAU in one calendar month before 30 November 2026
- Public GitHub repository with a complete README
- Demo video under 90 seconds, workload to unblind
- X post with the video and the marketplace listing
- Builder Discord presence
- One meaningful maintenance improvement every month after qualification
