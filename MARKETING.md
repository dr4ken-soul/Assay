# MARKETING.md: Assay

## Goal

Get Assay in front of Anna users who hold keys for more than one model, and turn them into repeat trial runners. The story is simple: you are choosing models on marketing, your own workload is the only benchmark that matters, and Assay makes that argument blind. Every post proves the product works, nothing explains what is merely planned.

Core proof to show in public: a real workload pasted, three anonymised columns running live, the verdict landing with scores, cost and latency, the unblind flip revealing the names, the policy exporting as JSON.

---

## Posting Style

- all lowercase
- builder voice, not company voice
- one clear idea per post
- short lines with space between thoughts
- show what works, do not describe what is coming
- the demo video does the heavy lifting, copy supports it

---

## Post Plan

### post 1, marketplace announcement

```
assay is live on the anna marketplace

paste a workload you actually run, pick your models, and they all answer
at once with the names stripped

scores, token cost and latency come back blind. crown a winner before
the reveal, then see which model actually earned it

every crown shifts a routing policy you can export as json and drop
into your own agents

your prompt is the benchmark now

[marketplace listing link]
```

Attach a screen recording of one full trial, workload to unblind, kept under 60 seconds.

---

### post 2, dora submission

```
submitted assay to the anna ai app builder program @dora_hacks

blind trials for your model stack: one real workload, every model on
trial, names sealed until the verdict lands

runs on anna credits or your own keys, byok counts the same

the verdict anatomy on the landing page is a real recorded trial, the
workload is published next to it, no invented numbers anywhere

[demo video] [marketplace link] [github]
```

Attach the final demo video. Submit before 30 September 2026 15:59.

---

### post 3, the recurring argument, october onwards

```
new model dropped this week

before you switch anything, run it through assay against your current
default on your own workload

three runs, blind verdicts, cost and latency measured server side

the leaderboard did not test your prompt. assay does
```

Attach a screenshot of a verdict next to an unblind. Post one of these each time a major model ships, the cadence is the channel.

---

## Submission Notes

**Project title:** Assay

**Tagline:** The blind trial for your model stack.

**Program:** Anna AI App Builder Program, DoraHacks hackathon 2349.

**Project description, under 200 words:**

Assay is a blind trial bench for LLM users on Anna OS. Paste a real workload, pick the models you already have keys for, and Assay runs it across all of them in parallel with the names stripped and shuffled. When the run finishes you get a blind verdict: rubric scores, token cost, latency and divergence notes across anonymised outputs. Crown a winner before the reveal, then lift the blind and see which model actually earned it.

Every crown feeds a personal routing policy. After a handful of trials, Assay holds your default, your fallback and your budget lane per task type, exportable as plain JSON for your own agents.

The judge never sees model names. Cost is computed from measured tokens against a versioned price table. Failed providers degrade to marked columns, nothing is substituted or retried into existence.

Runs on Anna credits or BYOK, both count the same. The landing page's verdict anatomy is a real recorded trial with the workload published beside it.

**Demo video flow, 90 seconds:**
1. Open the bench, paste a real workload (10 seconds)
2. Pick three models from the roster chips (8 seconds)
3. Run, three anonymised columns streaming, timers and cost accruing (15 seconds)
4. Verdict lands, rubric bars fill, divergence notes visible (15 seconds)
5. Crown a winner blind (8 seconds)
6. Unblind flip, crowned column revealed with the stamp (10 seconds)
7. Cut to the policy screen, weights shifted, export copied (12 seconds)
8. End on the Assay wordmark over the bench surface (7 seconds)

Total: 85 seconds.

**Built with:**
- Anna App, schema 2 manifest, Executa tool in Node.js and TypeScript
- React 18, Tailwind CSS, motion/react
- Anna sampling for the blind examiner, BYOK credentials for the roster
- Anna Persistent Storage for the ledger and policy
- Next.js 14 landing page on Vercel

---

## Checklist

- [ ] Marketplace listing approved and live before any post
- [ ] At least three real trials recorded before recording the demo video
- [ ] Verdict anatomy bound to recorded data, unbacked cards removed
- [ ] Demo video recorded and trimmed under 90 seconds
- [ ] DoraHacks BUIDL submitted before 30 September 2026 15:59
- [ ] Post 1 out the day the listing is live
- [ ] Post 2 out at submission with the video attached
- [ ] Builder Discord joined, sharing trials in the community, no run incentives ever
- [ ] Post 3 template ready for every major model launch through Q4
- [ ] 200 Qualified App MAU in one calendar month before 30 November 2026
- [ ] Reply to every piece of trial feedback with a shipped improvement, monthly maintenance is a program requirement and the feedback loop is the cheapest way to meet it
