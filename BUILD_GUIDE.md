# Assay — Build Guide

## Before You Write a Single Line of Code

Read APP_BLUEPRINT.md and FRONTEND_SPEC.md in full. Every tool method, the judge prompt, the APS schema and the MAU mechanics are in APP_BLUEPRINT.md. Every class, animation value, z-index and piece of copy for both the landing page and the app interior is in FRONTEND_SPEC.md. This guide sequences the build, it does not repeat what exists at full fidelity elsewhere. CLAUDE.md is the persistent context file and sits alongside this guide.

---

## Phase 0 — Platform Prerequisites

1. Create the Anna account at `anna.partners`
2. Activate the developer profile in the Developer Console, it is self-serve and instant
3. Read the AI-readable docs before writing anything: fetch `https://anna.partners/llms.txt` and paste it into the coding agent's context. The docs index every page used below
4. Bookmark the four pages this build leans on hardest, confirm exact commands and field names against them, they are the source of truth over this guide:
   - `/developers/apps/app-quickstart.md` for the `anna-app` CLI scaffold and dev loop
   - `/developers/apps/app-manifest.md` and `/developers/apps/app-ui-manifest.md` for the schema 2 manifest
   - `/developers/tools/executa-sampling.md` for host LLM calls without a key
   - `/developers/tools/executa-credentials.md` and `/developers/tools/executa-storage.md` for BYOK injection and APS
5. Clone the official examples repo as reference, `github.com/whtcjdtc2007/anna-executa-examples`, treat it as reference, not a folder to build inside

```bash
node --version    # 18 or higher
npm --version     # 9 or higher
git --version
```

---

## Phase 1 — Scaffold the App

Follow the quickstart to scaffold, then shape the tree to match the structure in CLAUDE.md.

```bash
mkdir assay && cd assay && git init
# scaffold per /developers/apps/app-quickstart.md using the anna-app CLI
```

Set the manifest to match APP_BLUEPRINT.md: one bundled tool `assay-core`, one UI bundle, host API grants for `tools` and `storage`. Confirm grant names against the live UI manifest reference, do not trust memory.

Root `.env.example`, keys only, never values:

```
# no secrets live in this project by design
# BYOK credentials arrive through Anna's credential injection
# nothing else is required
```

---

## Phase 2 — The Executa Tool

### Step 2.1: Roster

Create `executas/assay-core/src/roster.ts`. Discover the models available to this user: providers with injected credentials first, then the sampling-backed set. Key status is a boolean per model, the key itself is never read, logged or returned.

```typescript
/**
 * Lists the models available for a trial, with a boolean key status.
 * Never exposes credential material, only presence.
 * @returns roster entries sorted by provider then model name
 */
export async function listRoster(): Promise<RosterEntry[]>
```

### Step 2.2: Trial execution and anonymisation

Create `executas/assay-core/src/trial.ts`. `startTrial` shuffles the roster with a seeded shuffle, assigns letters in run order, persists the mapping to APS, then executes one call per letter with `Promise.allSettled`. Wall-clock latency wraps each call. Token counts come from the provider response where available, estimated from character count where not, and the estimate is flagged in the record.

A failed call marks the column FAILED, captures the error class only, provider, status, timeout, auth, and excludes it from the verdict. No retry, no substitution.

The letter-to-model mapping is written to storage before the first call so a crash can never reveal a name through ordering.

### Step 2.3: The judge

Create `executas/assay-core/src/judge.ts`. Call the sampling endpoint with the verbatim rubric prompt from APP_BLUEPRINT.md, the task text and the anonymised outputs. Parse strict JSON, validate against the verdict schema, re-ask once on invalid JSON, then surface a clean error if it fails again. The judge input must be string-searched for provider names before sending, abort if any roster model name appears in the payload.

### Step 2.4: Cost and verdict assembly

Create `executas/assay-core/src/cost.ts` with a versioned price table, one source file, one version constant, updated in a meaningful maintenance commit whenever provider pricing shifts. Assemble the verdict: rubric scores, cost, latency, value ratio, divergence notes.

### Step 2.5: Policy

Create `executas/assay-core/src/policy.ts`. Crowns update per-model exponential moving averages with a decay for unused models, seeded from the verdict's scores, cost and latency. Locks are explicit user choices per task type. Export serialises to plain JSON.

### Step 2.6: Storage

Create `executas/assay-core/src/store.ts` wrapping APS. Keys per APP_BLUEPRINT.md: `trials/{id}`, `policy/current`, `policy/version`. Every read and write is namespaced to the current user by the platform, rely on that, never add user identifiers to keys.

### Step 2.7: Rate limiting

Six trials per user per hour, enforced in the tool before any model call, tracked in APS. Over the limit returns a clean error with the reset time. This protects the user's spend and keeps every recorded run genuinely qualified.

---

## Phase 3 — The UI Bundle

### Step 3.1: Design system wiring

Translate FRONTEND_SPEC.md 1.1, 1.2 and 1.6 into the Tailwind config and globals exactly as written. Fonts via Fontshare and Google, CSS variables only, scrollbar rules, noise grain overlay mounted once at the root.

### Step 3.2: Host API layer

Create `ui/src/lib/host.ts` wrapping the tool invocation surface. Every call goes through it, with typed results and typed errors, so no view ever touches the raw host API. JSDoc every wrapper.

### Step 3.3: Shell and views

Build `App.tsx` with the tabbed header and view transitions per FRONTEND_SPEC.md 11.1. Then the three views in order of value: Bench through its four states, 11.2 to 11.5, then History 11.6, then Policy 11.7. Skeleton shimmer on every pending state, inline errors with cause and fix, empty states with a primary action.

### Step 3.4: Verify the blind

Before anything else, verify: during a run and in the verdict state, no model name exists in the DOM. Grep the rendered output during the running and verdict states as an automated check. This is the product's core promise, it gets a test, not a hope.

---

## Phase 4 — Local Development and Testing

1. Run the app locally per the quickstart with `anna-app dev`
2. Test the plugin per `/developers/apps/testing-plugin.md` with the executa test fixtures
3. Test the bundle per `/developers/apps/testing-bundle.md` with `mountBundle`, same ACL gating as the dev harness
4. Record a session per `/developers/apps/recording-replay.md`, replay it after changes, the blind check from Step 3.4 belongs in this replay
5. Run at least three real trials: all keys valid, one key invalid, sampling-only. Confirm the FAILED column behaviour and that the verdict excludes it

---

## Phase 5 — Listing and Publication

1. Fill the listing fields per `/developers/apps/app-listing.md`. Declared primary function: run a blind trial and return a verdict. This exact sentence matters, it is what a Qualified App Run is measured against
2. Version and submit per `/developers/apps/app-publish.md` and `/developers/apps/app-versioning.md`
3. Review normally completes in 3 to 5 business days. The review checks complete experience, AI-native core, functional completeness, distinctiveness and UX. APP_BLUEPRINT.md's compliance table maps each criterion, keep that table honest before submitting
4. After approval, confirm the app installs and runs from a fresh Anna account

---

## Phase 6 — Landing Page

```bash
cd web
npx create-next-app@latest . --typescript --tailwind --app
npm install motion
```

1. Wire the design system from FRONTEND_SPEC.md 1.1, 1.2 and 1.6 into the Tailwind config and globals
2. Build `CalibrationField.tsx` per 1.4, mount once in `layout.tsx`
3. Build `MorphNav.tsx` per section 2
4. Build the eight sections in order, one file each, exactly per sections 3 to 10
5. Produce the seven bench assets per section 14, pull or generate, graded to the three approved samples, under 500KB each
6. Run at least one real trial through the published app, record it, and bind the anatomy and metrics sections to that recorded data. If a number cannot be backed, remove its card
7. Deploy to Vercel

---

## Phase 7 — Quality Audit

**Tool audit:**
- No model name in any log line before unblind
- FAILED columns never substitute or retry
- Rate limit holds across a restart, APS-backed
- Judge payload contains zero provider names, string-searched
- Price table version constant bumps with any pricing change

**UI audit:**
- The blind DOM check passes in running and verdict states
- Every whileInView uses `once: false, amount: 0.1`
- Skeleton shimmer on every pending state, no spinners
- Focus rings visible on every interactive element
- Reduced motion flattens the CalibrationField and all blur-ins
- No hardcoded hex outside the design system files
- No localStorage or sessionStorage anywhere

**Landing audit, in addition to the FRONTEND_SPEC.md self-check:**
- Every number traces to a recorded trial
- Morph pill collapses and re-expands correctly around the 80px boundary
- CalibrationField density shifts between hero, sparse and dense sections
- Mobile: hero tile stacks below the CTA cluster, no horizontal overflow
- All seven assets share one surface, one light, one red accent

**Program audit:**
- Listing primary function matches the Qualified App Run definition
- App installed from a fresh account, full trial to unblind to policy export
- Demo video recorded, under 90 seconds
- DoraHacks BUIDL submitted before 30 September 2026 15:59
