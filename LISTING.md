# Assay, listing copy

Copy for the Anna Marketplace listing and the app's own `system_prompt_addendum`.
Every claim below traces to the code or a recorded trial. Nothing is estimated.

## Name

Assay

## One line

Run one real workload across every model you have selected, with the names hidden, then find out which model actually earned it.

## What it does

Assay takes a single piece of work you actually need done, sends it to several language models at once, and hides which model produced which answer. The outputs arrive as MODEL A, MODEL B, MODEL C, with the letters shuffled on every run so position never leaks the answer.

A blind examiner then scores the anonymised outputs against a fixed rubric, and you get a verdict with per-model scores, token cost, latency and any place the models disagreed.

You pick a winner while the names are still hidden. Only then does the blind lift.

## Why blind

Model names change how a reader judges an answer. A reply attributed to a model you trust gets read more generously than the same reply attributed to one you do not. Showing the name first makes the comparison worthless.

Assay removes the name before you see anything, and keeps it removed until you have committed to a choice. The crown you pick is your own judgement on evidence, not a reaction to a brand.

## What you get

**A real workload, not a benchmark.** Paste the task you actually need done. Assay does not score you against a leaderboard, it scores the work.

**Anonymised columns.** Every output is labelled with a letter. The mapping is sealed before the first call is made and cannot be read early.

**A fixed rubric.** Correctness, instruction fit, concision, tone and grounding, each scored out of five and combined into a single quality share. The weights are published and identical on every run, so scores are comparable between trials.

**Token cost and latency.** Measured where the provider reports them, and marked as estimated where it does not. Assay never presents an estimate as a measurement.

**Divergence.** Where two models took genuinely different routes, the examiner says so instead of averaging them into agreement.

**A personal routing policy.** Each crown moves a per-model score. Over a handful of trials Assay holds a ranking, and you can lock a model to a task type: your default for drafting, your fallback, your budget option. Export it as JSON.

## Honest limits

**Cost figures are absent for Anna lanes.** When a model is served by Anna rather than by your own key, the price is not available to the tool, so the cost column is blank and marked unavailable. It is never filled with an estimate.

**A blind trial needs at least two models.** One column is not a comparison.

**The tool cannot see your repository.** It runs the workload you paste and nothing else.

## Models on the bench

Models you bring with your own key are listed once that key is present, grouped by provider. The roster shows which models are available to you right now and never displays key material, only presence.

Alongside those, three Anna lanes are offered: a quality lane, a speed lane and a cost lane. Each asks the host for a different trade-off. The concrete model the host serves is recorded at call time and revealed at the unblind, so the reveal names a real model rather than a lane.

## Getting started

1. Open Assay and paste a workload.
2. Select at least two models.
3. Run the blind trial.
4. Read the verdict and crown a column.
5. Lift the blind to see which model earned it.

Crowns accumulate. After a few trials the policy screen carries your ranking and you can lock models to task types.
