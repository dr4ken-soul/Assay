# Running a real trial, and what to capture

The listing needs screenshots of the app doing the thing it claims. This is the
procedure, written down so it is repeatable and so nothing in the listing is
remembered rather than observed.

## Before the first trial

Two things must be true. Check both, do not assume.

**The app must be installed and the tool must load.** Open the app. If the bench
shows model chips, the tool loaded. If it shows an empty state, the tool did not
load and nothing else in this document applies.

**A workload must be pasted.** The trial is billed, so do not start one to see
what happens.

## The workload

Use a task with a checkable right answer and constraints on all five rubric
dimensions. A worked example, used for the first recorded trial, is a JavaScript
path-handling bug with a provably correct fix and constraints on length, tone and
API grounding.

The blind examiner scores correctness, instruction fit, concision, tone and
grounding. A workload that only exercises correctness will produce a verdict
that cannot separate strong models from weak ones.

## Running it

1. Paste the workload into the WORKLOAD box.
2. Select at least two models. Leave the three Anna lanes selected for the first
   trial; they ask the host for different trade-offs, which gives the trial
   something to disagree about.
3. Press RUN BLIND TRIAL. The button is inert until the workload box has content.
4. Wait. Columns run in parallel. The verdict arrives after the slowest column
   settles, plus one examiner call.

## What to screenshot

Capture these in order. The listing uses them in this order.

| # | State | What it proves |
|---|---|---|
| 1 | Setup, workload pasted, chips selected | The tool loaded and can see a real workload |
| 2 | Running, letters sealed | Names really are hidden during the run |
| 3 | Verdict with rubric scores | The blind examiner scored something real |
| 4 | Crown buttons | The choice is the operator's, made blind |
| 5 | Unblind reveal | Letters map to real models, recorded at call time |
| 6 | History tab | The trial persisted |
| 7 | Policy tab | Crowns moved the ranking |

## Rules for what goes in the listing

**Never edit a score.** If a model scored 2 on correctness, the listing says 2.

**Never invent a trial.** Every number on the landing page traces to a row in
`web/src/data/corpus.ts`, and every row in that file traces to a trial that ran.
A card that cannot be backed is removed, not estimated.

**Never name a model before the unblind.** Not in a screenshot, not in the
listing, not in a commit message.

**A failed column is not a low score.** A column that failed carries an error
class and an operator hint, and is excluded from the verdict. It is never scored
and never substituted. If a screenshot shows a failed column, that is a bug
report, not listing material.

## Where the results go

Paste the recorded trial into `web/src/data/corpus.ts`, set `bound: true`, and
set `measures.ts` to match. The corpus is empty by design: no card renders until
a real trial backs it.

## If a trial fails

Read the hint on the failed column. Since v0.1.6 the hint names the subsystem
that actually broke. A host that refuses sampling says so, and does not send you
looking for an API key that was never involved.
