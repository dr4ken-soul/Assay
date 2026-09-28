# FRONTEND_SPEC.md — Assay

Blind trials for your model stack. One real workload in, every model on trial, names sealed until the verdict lands. Built for the Anna AI App Builder Program, Founding Builder cohort.

---

## 0. Project Identity

- **Name:** Assay
- **One-line pitch:** Assay runs your real workload across the models you already pay for, strips the names, and returns a blind verdict on quality, cost and latency.
- **Aesthetic (Gate 1):** Bento grid operational
- **Identity Fingerprint (§0C):** top-left lead with bottom-right support / Swiss rational / pristine light clinical bench / technical grid and dot field / front-loaded / editorial reveal
- **Dials:** DESIGN_VARIANCE 6, MOTION_INTENSITY 4, VISUAL_DENSITY 7
- **Navigation (Gate 2):** A2 scroll-morph pill on the landing page, tabbed header inside the app
- **Background (Gate 3):** bespoke CalibrationField, coded canvas, plus staggered viewport reveal on every section
- **Fonts (Gate 4):** Satoshi for display and body, Fragment Mono for data
- **Palette (Gate 5):** clinical bench, light, indicator red
- **Art system:** the Assay Bench series, precision instrument imagery on the cool bench surface, one red indicator accent, never in the hero
- **Scope:** landing page on Vercel plus the in-Anna app interior

---

## 1. Global Design System

### 1.1 Fonts

```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Fragment+Mono:ital@0;1&display=swap');

:root {
  --font-display: 'Satoshi', sans-serif;   /* weight 900 only, headlines */
  --font-body:    'Satoshi', sans-serif;   /* weights 400 and 500 */
  --font-mono:    'Fragment Mono', monospace; /* single weight 400 */
}
```

Fragment Mono ships one weight. Mono emphasis is achieved with uppercase, tracking and the indicator red, never with synthetic bold. Total weight budget across the page: 900, 500, 400.

### 1.2 Colour System (Gate 5, confirmed)

```css
:root {
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

  --radius-sm: 2px;  --radius-md: 4px;  --radius-lg: 8px;
  --shadow-sm: 0 1px 2px rgba(20, 24, 20, 0.05);
  --shadow-md: 0 2px 8px rgba(20, 24, 20, 0.07);
  --duration-fast: 120ms; --duration-normal: 220ms; --duration-slow: 400ms;
}
```

Colour strategy: Restrained. The accent touches 10 percent of the surface or less. Muted text is reserved for large uppercase mono labels, secondary text carries real copy.

### 1.3 Global Z-Index Map

```
z-0:  CalibrationField, fixed coded canvas, pointer-events-none
z-3:  noise grain overlay, absolute inset-0, pointer-events-none, opacity 0.03
z-10: section content, relative, default for all section containers
z-20: hero trial tile and other floating panels within a section
z-40: mobile drawer panel
z-45: mobile drawer scrim
z-50: morph pill navigation, fixed
```

### 1.4 The CalibrationField (bespoke, no recipe match)

The page's one ambient system. Coded, never sourced. A fine measurement grid with a slow sweep line that travels the viewport and carries a live readout, the instrument calibrating before your trial.

```
Container: fixed inset-0 z-0 pointer-events-none
Renderer: single 2D canvas, devicePixelRatio aware, drawn on requestAnimationFrame

Grid:
  Vertical and horizontal lines every 48px
  Stroke: var(--text-primary) at 5 percent opacity, 1px
  Every 4th line slightly stronger, 8 percent opacity

Sweep:
  A vertical line travelling left to right across the viewport over 14s,
  then wrapping with a 1.2s fade at both edges
  Line: var(--accent) at 55 percent opacity, 1px
  Trail: linear gradient 120px wide behind the line, var(--accent) at
    8 percent opacity fading to transparent
  Head: a small tick crosshair where the sweep crosses the top ruler

Ruler:
  Tick marks along the top edge only, minor every 48px at 2px height,
  major every 240px at 6px height, ink at 15 percent opacity

Readout:
  A mono label riding 16px right of the sweep line, vertically centred
  Content: "CAL 0.482" where the number is the sweep position normalised
    0.000 to 1.000, tabular-nums, text at 30 percent ink opacity
  The label flips to "READY" for the 0.4s around position 1.000

sectionDensity (shared React context, written by an IntersectionObserver
on each <section data-density="dense|sparse|hero">):
  hero and final CTA in view   -> target opacity 0.55
  sparse sections in view      -> target opacity 0.35
  dense sections in view       -> target opacity 0.15
  Transition: opacity lerps toward target at 0.04 per frame, never snaps

Reduced motion: grid renders static, sweep parks at 62 percent with the
readout frozen at "CAL 0.620", opacity fixed at 0.25
```

### 1.5 Motion Primitives

Standard entrance used by every element unless a section overrides it:

```
initial:  { filter: 'blur(10px)', opacity: 0, y: 20 }
animate:  { filter: 'blur(0px)', opacity: 1, y: 0 }
transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
viewport:  { once: false, amount: 0.1 }
```

Stagger for grouped children: `delay: 0.15 + index * 0.09`, in seconds. Every scroll animation replays on re-entry, `once: false` always, no exceptions anywhere in this project.

### 1.6 Global Chrome

```css
html {
  scrollbar-width: none;
  scroll-behavior: smooth;
}
::-webkit-scrollbar { display: none; }
```

Noise grain overlay on every page, mounted once at the root:

```
fixed inset-0 z-3 pointer-events-none opacity-[0.03]
background-image: inline SVG fractalNoise, baseFrequency 0.9, numOctaves 4
background-size: 128px 128px
```

Focus states: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2` on every interactive element.

---

## 2. Navigation — Gate 2: A2 Scroll-Morph Pill

```
EXPANDED STATE (scrollY < 80):
  Position: fixed top-0 inset-x-0 z-50
  Height: h-16, px-6 md:px-10
  Background: transparent, no border
  Layout: flex items-center justify-between

  Wordmark (left):
    font-display font-black text-xl tracking-[-0.02em] text-[var(--text-primary)]
    Text: "ASSAY"
    Companion tag, hidden below md:
      font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)] ml-3
      Text: "BLIND TRIALS"

  Links (centre, hidden below lg):
    flex items-center gap-8
    Each: font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]
      hover:text-[var(--accent)] transition-colors duration-200
    Links: "THE METHOD", "ANATOMY", "POLICY"

  CTA (right):
    bg-[var(--text-primary)] text-[var(--bg-elevated)] px-5 py-2.5 rounded-full
    font-mono text-xs uppercase tracking-[0.08em]
    hover:bg-[var(--accent)] hover:text-white transition-colors duration-200
    Label: "OPEN IN ANNA"

MORPH TRIGGER:
  At scrollY > 80, the bar collapses into a centred floating pill using a
  Framer Motion layoutId shared element transition on the pill container.
  transition: { type: 'spring', stiffness: 260, damping: 30 }

COLLAPSED STATE (scrollY > 80):
  Position: fixed top-4 left-1/2 -translate-x-1/2 z-50
  Shell: bg-[var(--bg-elevated)]/90 backdrop-blur-xl
    border border-[var(--border-default)] rounded-full
    px-5 py-2.5 flex items-center gap-6 shadow-[var(--shadow-md)]
  Contents: wordmark, thin divider (w-px h-4 bg-[var(--border-default)]),
    CTA button (same classes as expanded)
  Centre links are withdrawn, a hamburger appears for the drawer

MOBILE DRAWER (below lg):
  Hamburger: flex flex-col gap-[5px], three spans
    w-5 h-[2px] bg-[var(--text-primary)]
    Open state: rotate-45 translate-y-[7px], middle opacity-0,
    bottom -rotate-45 -translate-y-[7px], 300ms ease
  Scrim: fixed inset-0 z-45 bg-[var(--text-primary)]/20 backdrop-blur-sm,
    opacity 0 -> 1 over 0.3s
  Panel: fixed top-0 right-0 h-full z-40 w-[82vw] max-w-[320px]
    bg-[var(--bg-surface)] border-l border-[var(--border-default)] px-8 py-10
    initial: { x: '100%' } / animate: { x: 0 } / exit: { x: '100%' }
    transition: { type: 'spring', stiffness: 300, damping: 32 }
    Link rows: font-mono text-sm uppercase tracking-[0.15em] py-4
      border-b border-[var(--border-subtle)] text-[var(--text-primary)]
      hover:text-[var(--accent)] transition-colors
    Rows: THE METHOD, ANATOMY, POLICY, OPEN IN ANNA, GITHUB, X
```

---

## 3. Section: Hero

**Recipe:** `product-mockup-hero` (from COMPOSITION_RECIPES.md), inverted to a light bento register and recomposed to the fingerprint: top-left lead, bottom-right support. Quality benchmark: Golden Reference 3.

```
z-index within section: content z-10, trial tile z-20

SECTION: Hero
Layout: relative min-h-[100dvh] overflow-hidden
data-density="hero"
Background: none, CalibrationField reads through at 0.55

CONTENT (top-left lead):
  Container: relative z-10 px-6 md:px-10 lg:px-16 pt-32 md:pt-36 max-w-[720px]

  Headline:
    font-display font-black uppercase
    text-[clamp(2.75rem,7vw,6.25rem)] leading-[0.92] tracking-[-0.03em]
    text-[var(--text-primary)] text-wrap: balance
    Two lines: "PUT YOUR MODELS" / "ON TRIAL."
    Animation: word-by-word blur reveal
      each word: blur(10px) opacity 0 y 24 -> blur(0) opacity 1 y 0
      duration 0.7s, ease [0.16, 1, 0.3, 1], delay wordIndex * 0.09s

  Subheading:
    mt-6 max-w-[52ch] font-body text-base md:text-lg
    text-[var(--text-secondary)] leading-relaxed
    Text: "Assay runs your real workload across the models you already
      pay for, strips the names, and returns a blind verdict on quality,
      cost and latency. You choose on evidence, not marketing."
    Animation: standard entrance, delay 0.55s

  CTA cluster:
    mt-10 flex flex-wrap items-center gap-4
    Animation: standard entrance, delay 0.75s
    Primary: bg-[var(--text-primary)] text-[var(--bg-elevated)] px-7 py-3.5
      rounded-full font-mono text-sm uppercase tracking-[0.08em]
      hover:bg-[var(--accent)] hover:text-white transition-colors duration-200
      Trailing icon circle per the button-in-button pattern:
        w-8 h-8 rounded-full bg-white/15 flex items-center justify-center,
        inline SVG arrow, group-hover:translate-x-0.5
        group-hover:-translate-y-px transition-transform duration-200
      Label: "OPEN IN ANNA"
    Secondary: border border-[var(--border-default)]
      text-[var(--text-primary)] px-7 py-3.5 rounded-full font-mono text-sm
      uppercase tracking-[0.08em] hover:border-[var(--accent)]
      hover:text-[var(--accent)] transition-colors duration-200
      Label: "SEE THE ANATOMY"
      Behaviour: smooth-scrolls to the Verdict Anatomy section

TRIAL TILE (bottom-right support):
  Position: relative z-20 mt-14 lg:mt-0
    lg:absolute lg:bottom-16 lg:right-16
    w-full max-w-[420px] lg:w-[420px]
  Double bezel per the doppelrand pattern:
    Outer: p-2 rounded-[12px] bg-[var(--bg-secondary)]
      ring-1 ring-[var(--border-subtle)]
    Inner: rounded-lg bg-[var(--bg-elevated)] p-5
      shadow-[inset_0_1px_1px_rgba(255,255,255,0.65),var(--shadow-sm)]
  Entrance: initial { opacity: 0, y: 30, scale: 0.97 }
    -> { opacity: 1, y: 0, scale: 1 }
    duration 0.9s, ease [0.16, 1, 0.3, 1], delay 0.9s

  Header row: flex items-center justify-between mb-4
    Label: font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]
      Text: "LIVE TRIAL 0047"
    Status: flex items-center gap-1.5
      Dot: w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse
      Text: font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--accent)]
        "RUNNING"

  Columns: grid grid-cols-3 gap-3
    Column (x3, MODEL A, MODEL B, MODEL C):
      border border-[var(--border-subtle)] rounded-md p-3 bg-[var(--bg-surface)]
      Letter: font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]
      Latency: font-mono text-sm tabular-nums text-[var(--text-primary)] mt-2
        counting up from 0.00s, live
      Cost: font-mono text-[11px] tabular-nums text-[var(--text-muted)] mt-1
        accruing from $0.0000, live
      Output: mt-3 space-y-1.5, three shimmer lines
        h-2 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)]
        with animate-shimmer overlay, widths 100, 86, 64 percent
      Values use the Text Scramble technique on mount,
        chars set "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#", speed 30

  Footer strip: mt-4 pt-4 border-t border-[var(--border-subtle)]
    flex items-center justify-between
    Left: font-mono text-[11px] text-[var(--text-secondary)]
      Text: "NAMES SEALED UNTIL VERDICT"
    Verdict flip (fires once after 6s of page time):
      font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--accent)]
      border border-[var(--accent)] rounded-[var(--radius-sm)] px-2 py-1
      Text: "B +38% FASTER AT 0.9X QUALITY"
      Animation: initial { opacity: 0, scale: 0.9, rotate: -2 }
        -> { opacity: 1, scale: 1, rotate: 0 }
        spring stiffness 320 damping 22

Mobile: tile stacks below the CTA cluster, full width, entrance unchanged.
```

---

## 4. Section: Statement

**Recipe:** `full-width-statement` (from COMPOSITION_RECIPES.md). No customisation beyond palette.

```
z-index: content z-10

SECTION: Statement
data-density="sparse"
Layout: py-28 md:py-40 flex items-center
Background: none, CalibrationField at 0.35

Container: w-full px-6 md:px-10

Statement text:
  font-display font-black uppercase
  text-[clamp(2.25rem,6.5vw,5.5rem)] leading-[0.95] tracking-[-0.02em]
  text-[var(--text-primary)] text-centre text-wrap: balance
  Text: "YOU ARE CHOOSING MODELS ON MARKETING."
  Animation: word-by-word blur reveal
    blur(8px) opacity 0 y 20 -> blur(0) opacity 1 y 0
    duration 0.6s, ease [0.16, 1, 0.3, 1], stagger wordIndex * 0.09s

Metadata line:
  font-mono text-xs tracking-[0.2em] text-[var(--text-muted)] mt-8 text-centre
  Text: "PUBLISHER BENCHMARKS ARE ADS. YOUR WORKLOAD IS EVIDENCE."
  Animation: standard entrance, delay 0.9s
```

---

## 5. Section: The Method

**Recipe:** `architecture-layers` (from COMPOSITION_RECIPES.md), adapted: each layer card gains a specimen art tile, and a scroll-drawn connector runs down the left margin.

```
z-index: content z-10, connector z-0 within the section

SECTION: The Method
data-density="dense"
Layout: relative py-24 md:py-32 px-6 md:px-10
Background: bg-[var(--bg-primary)] (solid, CalibrationField hidden)

Container: max-w-4xl mx-auto

Heading:
  mb-14
  Eyebrow: font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)] mb-4
    Text: "THE METHOD"
  Title: font-display font-black uppercase text-3xl md:text-4xl
    tracking-[-0.02em] text-[var(--text-primary)]
    Text: "ONE WORKLOAD, FOUR MOVES"
  Entrance: standard, delay 0.1s

Connector (left margin, desktop only):
  A vertical SVG line at left -28px relative to the cards, lg only
  Path from the first card's centre to the last card's centre
  Stroke: var(--border-default), 1px
  Head segment: last 60px stroke var(--accent), 2px
  Drawn on scroll: strokeDashoffset mapped to section scroll progress
    via useScroll and useMotionValueEvent, scrubbed not snapped
  Reduced motion: rendered fully drawn, no animation

Layer cards: mt-2 flex flex-col gap-4

Card (x4):
  relative border border-[var(--border-default)] rounded-lg p-6
  bg-[var(--bg-surface)] hover:border-[var(--accent)]/50
  transition-colors duration-200
  Layout: flex items-start gap-5

  Step tag: font-mono text-xs text-[var(--accent)] min-w-[2.5rem] pt-4
    Values: "01", "02", "03", "04"

  Text block: flex-1
    Title: font-body text-base md:text-lg font-medium text-[var(--text-primary)]
    Description: font-body text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed

  Specimen tile: w-20 h-20 shrink-0 rounded-md overflow-hidden
    border border-[var(--border-subtle)]
    img: w-full h-full object-cover, loading="lazy"
    On hover: no scale, border shifts to border-[var(--accent)]/40
      transition-colors only, the image is never the animation target

  Content:
    01 ARM, caliper asset:
      "Paste a real workload and pick the models on trial.
       Your prompt is the benchmark now."
    02 RUN, stopwatch asset:
      "Every model answers in parallel. Latency and token cost are
       measured server side, names stay sealed."
    03 UNBLIND, prism asset:
      "Score the anonymised outputs against a fixed rubric, then lift
       the blind and see which model earned the verdict."
    04 ROUTE, rail points asset:
      "Assay folds every verdict into a routing policy you can export.
       Your default, your fallback, your budget lane."

Animation:
  Each card: standard entrance, delay 0.15 + index * 0.15s
  Specimen tiles: additional scale reveal
    initial { opacity: 0, scale: 0.92 } -> { opacity: 1, scale: 1 }
    duration 0.6s, ease [0.16, 1, 0.3, 1], delay 0.3 + index * 0.15s
```

---

## 6. Section: Verdict Anatomy

**Recipe:** `asymmetric-bento-grid` (from COMPOSITION_RECIPES.md). All data in this section renders from a real recorded Assay trial, the workload text is published beneath the report. No invented numbers anywhere in this section.

```
z-index: content z-10, annotation layer z-20

SECTION: Verdict Anatomy
data-density="dense"
Layout: py-24 md:py-32 px-6 md:px-10
Background: bg-[var(--bg-primary)]

Container: max-w-6xl mx-auto

Heading:
  mb-12
  Title: font-display font-black uppercase text-3xl md:text-4xl
    tracking-[-0.02em] text-[var(--text-primary)]
    Text: "ANATOMY OF A VERDICT"
  Subtitle: font-body text-sm text-[var(--text-secondary)] mt-3 max-w-[60ch]
    Text: "An annotated extract from a real Assay trial. The workload,
      the scores and the costs are exactly what the app recorded."
  Entrance: standard, delay 0.1s

Grid: grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6

CARD A, the report (lg:col-span-7, row-span-2):
  Double bezel: outer p-2 rounded-[12px] bg-[var(--bg-secondary)]
    ring-1 ring-[var(--border-subtle)]
    inner rounded-lg bg-[var(--bg-elevated)] p-6
  Header: font-mono text-[11px] uppercase tracking-[0.2em]
    text-[var(--text-muted)] flex justify-between mb-5
    "TRIAL 0001" / date of the real run
  Workload line: font-mono text-xs text-[var(--text-secondary)] mb-5
    prefixed "TASK:"
  Three model columns: grid grid-cols-3 gap-4
    Letter header: font-mono text-[10px] uppercase tracking-[0.2em]
      text-[var(--text-secondary)]
    Rubric rows (x5, correctness, instruction fit, concision, tone,
      grounding): each a label row and a bar
      Label: font-mono text-[10px] text-[var(--text-muted)] mt-2
      Bar track: h-1.5 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)]
      Bar fill: h-full bg-[var(--text-primary)] rounded-[var(--radius-sm)]
        width animated from 0 to score/5 * 100 percent,
        duration 0.8s, ease [0.16, 1, 0.3, 1], stagger index * 0.08s
        The winning fill switches to bg-[var(--accent)]
    Footer row per column: font-mono text-[11px] tabular-nums
      text-[var(--text-secondary)] mt-3
      "$0.0142 / 3.9s" style, real values from the trial
  Verdict line: mt-6 pt-4 border-t border-[var(--border-subtle)]
    font-mono text-xs text-[var(--text-primary)]
    Text: "VERDICT: B ON QUALITY, C ON VALUE. FULL MARGIN PUBLISHED BELOW."
  Annotations (blueprint callouts, z-20):
    Three absolute-positioned labels with 1px leader lines in
    var(--accent), font-mono text-[10px] text-[var(--text-secondary)]
    "RUBRIC, 0 TO 5", "SERVER-SIDE TIMING", "TOKEN COST, NOT SUBSCRIPTION"
    Each appears with standard entrance, stagger 0.2s apart, lg only

CARD B, the rubric (lg:col-span-5):
  border border-[var(--border-default)] rounded-lg bg-[var(--bg-surface)] p-6
  Title: font-body text-base font-medium text-[var(--text-primary)]
    Text: "SCORED BLIND, FIVE AXES"
  Rows (x5): flex justify-between py-3 border-b border-[var(--border-subtle)]
    last:border-0
    Axis: font-body text-sm text-[var(--text-secondary)]
    Weight: font-mono text-xs text-[var(--text-muted)]
    "Correctness 30 / Instruction fit 25 / Concision 15 / Tone 15 / Grounding 15"
  Footnote: font-mono text-[11px] text-[var(--text-muted)] mt-4 leading-relaxed
    Text: "THE EXAMINER NEVER SEES MODEL NAMES."

CARDS C, D, E, corpus stats (lg:col-span-4 each):
  border border-[var(--border-default)] rounded-lg bg-[var(--bg-surface)] p-6
  Value: font-display font-black text-3xl md:text-4xl text-[var(--text-primary)]
    tabular-nums
  Label: font-mono text-[11px] uppercase tracking-[0.15em]
    text-[var(--text-muted)] mt-2
  Values pulled from the recorded trial corpus at build time:
    C: "MEDIAN COST GAP FOUND" 
    D: "SECONDS TO VERDICT"
    E: "MODELS ON THE BENCH"
  If the corpus cannot back a number, the card is removed, never filled
  with an estimate

Animation:
  Cards A to E: standard entrance, stagger 0.12s per card
  Hover on any cell: bg-[var(--bg-elevated)] and translateY(-2px),
    transition duration 200ms, no scale transforms, per bento rules
```

---

## 7. Section: Metrics

**Recipe:** `metrics-section` (from COMPOSITION_RECIPES.md). The breathing section, followed by the knoll strip.

```
z-index: content z-10

SECTION: Metrics
data-density="sparse"
Layout: py-24 md:py-32 px-6 md:px-10
Background: none, CalibrationField at 0.35

Container: max-w-6xl mx-auto

Subtitle:
  text-centre font-mono text-xs uppercase tracking-[0.2em]
  text-[var(--text-muted)] mb-14
  Text: "MEASURED, NOT PROMISED"

Metrics grid: grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12 text-centre
Metric (x3):
  Number: font-display font-black text-5xl md:text-6xl lg:text-7xl
    text-[var(--text-primary)] leading-none tabular-nums
  Label: font-mono text-xs uppercase tracking-[0.15em]
    text-[var(--text-muted)] mt-3
  Divider (desktop only): border-r border-[var(--border-default)]
  Values render from the real corpus, same three measures as the
    anatomy cards
  Animation: count from 0 to value over 1.5s, ease-out,
    IntersectionObserver trigger, replays on re-enter, stagger 0.2s

Knoll strip:
  mt-16 relative rounded-lg overflow-hidden
  border border-[var(--border-default)]
  Aspect: aspect-[21/9] on desktop, aspect-[16/10] below md
  Image: w-full h-full object-cover, loading="lazy"
  Entrance: initial { opacity: 0, scale: 0.98, filter: 'blur(8px)' }
    -> { opacity: 1, scale: 1, filter: 'blur(0px)' }
    duration 0.9s, ease [0.16, 1, 0.3, 1], delay 0.3s
  Caption: mt-3 font-mono text-[10px] uppercase tracking-[0.2em]
    text-[var(--text-muted)] text-centre
    Text: "THE BENCH: CALIPER, FORK, WEIGHTS, PRISM, GAUGE"
```

---

## 8. Section: Policy

**Recipe:** `split-image-text` (from COMPOSITION_RECIPES.md), adapted: the image row becomes the beam balance art panel above the policy card.

```
z-index: content z-10

SECTION: Policy
data-density="dense"
Layout: py-24 md:py-32 px-6 md:px-10
Background: bg-[var(--bg-primary)]

Container: max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16

LEFT COLUMN (text):
  Eyebrow: font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)] mb-4
    Text: "YOUR POLICY"
  Heading: font-display font-black uppercase text-3xl md:text-4xl
    tracking-[-0.02em] leading-tight text-[var(--text-primary)]
    Text: "STOP PICKING MODELS. START ROUTING THEM."
  Body: font-body text-base text-[var(--text-secondary)] mt-5
    leading-relaxed max-w-[50ch]
    Text: "Every crown you make shifts the weights. After a handful of
      trials Assay knows your default, your fallback and your budget
      lane for each task type. Export the policy as JSON and drop it
      straight into your own agents."
  Bullets (x3): mt-8 space-y-3
    Each: flex gap-3 items-start
      Marker: w-1.5 h-1.5 rounded-[1px] bg-[var(--accent)] mt-2 shrink-0
      Text: font-body text-sm text-[var(--text-secondary)]
    "Weights shift with every crown, they decay when they go unused"
    "Locks per task type: draft, rewrite, extract, code, analyse"
    "One-click export, plain JSON, no lock-in"
  Animation: fade from left, initial { opacity: 0, x: -20 }
    -> { opacity: 1, x: 0 }, duration 0.7s, ease easeOut, delay 0.3s

RIGHT COLUMN (art panel plus policy card):
  Art panel: rounded-lg overflow-hidden border border-[var(--border-default)]
    aspect-[4/3] relative
    Image: w-full h-full object-cover, loading="lazy"
    Parallax: translateY mapped from -8px to 8px across the section's
      scroll progress, useScroll with target the section,
      spring smoothed, disabled below lg and under reduced motion
  Policy card, mt-6, double bezel:
    Outer: p-2 rounded-[12px] bg-[var(--bg-secondary)]
      ring-1 ring-[var(--border-subtle)]
    Inner: rounded-lg bg-[var(--bg-elevated)] p-5
    Header row: flex justify-between mb-4
      Label: font-mono text-[11px] uppercase tracking-[0.2em]
        text-[var(--text-muted)]
        Text: "POLICY V3"
      Counter: font-mono text-[11px] text-[var(--text-secondary)]
        Text: "12 VERDICTS RECORDED"
    Rows (x3, one per task type shown):
      flex justify-between py-3 border-b border-[var(--border-subtle)]
      last:border-0
      Task: font-body text-sm text-[var(--text-primary)]
      Route: font-mono text-xs text-[var(--text-secondary)]
      "DRAFT: A -> B -> BUDGET C", "EXTRACT: C -> A -> BUDGET C",
      "CODE: B -> A -> BUDGET C"
    Export button: mt-4 w-full border border-[var(--text-primary)]
      text-[var(--text-primary)] rounded-full py-2.5 font-mono text-xs
      uppercase tracking-[0.08em]
      hover:bg-[var(--text-primary)] hover:text-[var(--bg-elevated)]
      transition-colors duration-200
      Label: "EXPORT POLICY"
  Animation: fade from right, initial { opacity: 0, x: 20 }
    -> { opacity: 1, x: 0 }, duration 0.7s, ease easeOut, delay 0.5s
```

---

## 9. Section: Final CTA

Bespoke, no recipe match. The gauge macro becomes the moment the needle crosses the red line.

```
z-index: content z-10, art z-0 within the section

SECTION: Final CTA
data-density="hero"
Layout: relative min-h-[90dvh] overflow-hidden flex items-center
Background: var(--bg-primary) fallback colour

ART:
  Position: absolute inset-0 z-0
  Image: w-full h-full object-cover object-right, loading="eager"
  Readability wash: absolute inset-0
    background: linear-gradient(to right, var(--bg-primary) 34%,
      rgba(237, 240, 236, 0.88) 52%, rgba(237, 240, 236, 0.35) 78%,
      transparent 100%)
  Parallax: image translateY from 0 to -24px across section scroll,
    useScroll, spring smoothed, disabled under reduced motion
  The red needle sits right of centre and stays visible through the wash

CONTENT:
  Container: relative z-10 max-w-[640px] px-6 md:px-10 lg:px-16

  Headline:
    font-display font-black uppercase
    text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[0.95] tracking-[-0.02em]
    text-[var(--text-primary)] text-wrap: balance
    Text: "THE NEXT VERDICT IS YOURS"
    Animation: standard entrance, delay 0.2s

  Subtext:
    mt-5 max-w-[46ch] font-body text-base text-[var(--text-secondary)]
    Text: "Open Assay on Anna, paste the workload you ran this morning,
      and watch three models argue for your business with their names
      off."
    Animation: standard entrance, delay 0.4s

  CTA:
    mt-9 bg-[var(--text-primary)] text-[var(--bg-elevated)] px-8 py-4
    rounded-full font-mono text-sm uppercase tracking-[0.08em]
    hover:bg-[var(--accent)] hover:text-white transition-colors
    duration-200
    Label: "OPEN IN ANNA"
    Animation: standard entrance, delay 0.6s
```

---

## 10. Footer

```
z-index: content z-10

SECTION: Footer
data-density="dense"
Layout: py-14 px-6 md:px-10 border-t border-[var(--border-default)]
Background: bg-[var(--bg-primary)]

Container: max-w-6xl mx-auto flex flex-col md:flex-row md:items-center
  md:justify-between gap-8

Left:
  Wordmark: font-display font-black text-lg tracking-[-0.02em]
    text-[var(--text-primary)]
  Attribution: font-body text-xs text-[var(--text-muted)] mt-3
    Text: "Built for the Anna AI App Builder Program, Founding Builder cohort"

Right:
  flex flex-wrap gap-x-8 gap-y-3
  Each link: font-mono text-xs uppercase tracking-[0.15em]
    text-[var(--text-secondary)] hover:text-[var(--accent)]
    transition-colors
  Links: "MARKETPLACE", "GITHUB", "X", "DOCS"

Bottom row: mt-10 pt-6 border-t border-[var(--border-subtle)]
  flex justify-between font-mono text-[11px] text-[var(--text-muted)]
  Left: "© 2026 ASSAY"
  Right: "RUNS ON ANNA OS"
```

---

## 11. App Interior (in-Anna SPA)

### 11.1 Shell

```
Root: min-h-[100dvh] bg-[var(--bg-primary)] text-[var(--text-primary)]
  font-body, the noise grain overlay and scrollbar rules from 1.6 apply

Header: sticky top-0 z-50 h-14 px-4 md:px-6
  bg-[var(--bg-primary)]/90 backdrop-blur-xl
  border-b border-[var(--border-default)]
  Layout: flex items-center justify-between

  Left: wordmark, font-display font-black text-base tracking-[-0.02em]
    Text: "ASSAY"

  Tabs: flex items-center gap-1
    Tab (x3): px-4 py-2 rounded-[var(--radius-md)] font-mono text-xs
      uppercase tracking-[0.15em] text-[var(--text-secondary)]
      hover:text-[var(--text-primary)] transition-colors
    Active tab: text-[var(--text-primary)]
      bg-[var(--bg-surface)] border border-[var(--border-default)]
      plus a 2px red underline bar, rounded-[1px], animated with
      layoutId between tabs, spring stiffness 300 damping 30
    Tabs: "BENCH", "HISTORY", "POLICY"

  Right: run counter, font-mono text-[11px] text-[var(--text-muted)]
    Text: "TRIALS THIS MONTH: N", live from storage

View transitions: AnimatePresence mode wait
  enter: opacity 0 to 1, blur(6px) to blur(0), y 8 to 0, 0.3s
  exit: opacity 1 to 0, y -6, 0.18s, exit shorter than enter
```

### 11.2 Bench, setup state

```
Container: max-w-5xl mx-auto px-4 md:px-6 py-10

Workload label: font-mono text-[11px] uppercase tracking-[0.2em]
  text-[var(--text-secondary)] mb-2
  Text: "WORKLOAD"
Workload field: w-full min-h-[160px] p-4
  bg-[var(--bg-surface)] border border-[var(--border-default)]
  rounded-lg font-mono text-sm text-[var(--text-primary)]
  placeholder:text-[var(--text-muted)] leading-relaxed
  focus:border-[var(--accent)]/50
  focus:ring-2 focus:ring-[var(--accent-glow)] outline-none
  transition-colors duration-150
  Placeholder text: "Paste the task you actually run. Include the real
    constraints, the real format, the real tone."

Roster label: mt-8, same label style
  Text: "MODELS ON TRIAL"
Roster chips: mt-3 flex flex-wrap gap-2
  Chip: px-4 py-2.5 rounded-full border font-mono text-xs
    transition-all duration-200
  Inactive: border-[var(--border-default)]
    text-[var(--text-secondary)] bg-transparent
    hover:border-[var(--text-secondary)]
  Selected: border-[var(--text-primary)] bg-[var(--text-primary)]
    text-[var(--bg-elevated)]
  Selected chips gain a leading inline SVG check, spring scale in,
    stiffness 300 damping 20
  Minimum two selected to enable the run button, helper line below:
    font-mono text-[11px] text-[var(--text-muted)]
    "PICK AT LEAST TWO. THE BLIND NEEDS COMPANY."

Run button: mt-8, button-in-button pattern,
  bg-[var(--text-primary)] text-[var(--bg-elevated)] px-8 py-4
  rounded-full font-mono text-sm uppercase tracking-[0.08em]
  hover:bg-[var(--accent)] hover:text-white transition-colors
  disabled state: opacity-40 cursor-not-allowed, disabled attribute set
  Label: "RUN BLIND TRIAL"

Empty state (no keys configured, roster empty):
  border border-dashed border-[var(--border-default)] rounded-lg p-10
  text-centre
  Title: font-body text-base font-medium text-[var(--text-primary)]
    Text: "No models on the bench yet"
  Body: font-body text-sm text-[var(--text-secondary)] mt-2
    Text: "Add provider keys in Anna settings or run on Anna credits.
      Assay reads whatever Anna already holds."
  Action: inline link, font-mono text-xs uppercase tracking-[0.1em]
    text-[var(--accent)] underline underline-offset-4
    Text: "OPEN ANNA SETTINGS"
```

### 11.3 Bench, running state

```
Status line: flex items-center gap-2 mb-6
  Dot: w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse
  Text: font-mono text-xs uppercase tracking-[0.15em]
    text-[var(--text-secondary)]
    Text: "RUNNING. NAMES SEALED."

Columns: grid grid-cols-1 md:grid-cols-3 gap-4
  Column: border border-[var(--border-default)] rounded-lg
    bg-[var(--bg-surface)] p-5
    Letter: font-mono text-xs uppercase tracking-[0.2em]
      text-[var(--text-secondary)]
    Timer: font-mono text-2xl tabular-nums text-[var(--text-primary)] mt-3
      counting from 0.00s, 10Hz update
    Cost: font-mono text-xs tabular-nums text-[var(--text-muted)] mt-1
      accruing live
    Output stream: mt-4 space-y-2, skeleton shimmer lines,
      h-2 rounded-[var(--radius-sm)] bg-[var(--bg-secondary)],
      animate-shimmer, pseudo-random widths between 60 and 100 percent
    Failed column: border-[var(--error)]/40, letter header plus
      "FAILED" in font-mono text-xs text-[var(--error)], one inline
      error line with cause and retry hint, no output skeleton
```

### 11.4 Bench, verdict state

```
Header: font-display font-black uppercase text-2xl
  tracking-[-0.02em] text-[var(--text-primary)] mb-2
  Text: "THE BLIND VERDICT"

Subline: font-mono text-xs text-[var(--text-muted)] mb-8
  Text: "CROWN A WINNER BEFORE THE REVEAL"

Score grid: grid grid-cols-1 md:grid-cols-3 gap-4
  Column card: border border-[var(--border-default)] rounded-lg
    bg-[var(--bg-surface)] p-5
    Letter, rubric bars (same bar spec as the anatomy section, fills
      animate on entry), cost and latency footer row
    Divergence notes: font-mono text-[11px] text-[var(--text-secondary)]
      mt-4 leading-relaxed, prefixed "VS:"

Crown buttons: mt-8 flex flex-wrap gap-3
  Per column: border border-[var(--text-primary)] rounded-full
    px-5 py-2.5 font-mono text-xs uppercase tracking-[0.1em]
    text-[var(--text-primary)]
    hover:bg-[var(--text-primary)] hover:text-[var(--bg-elevated)]
    transition-colors
    Label: "CROWN A" and so on
    Once used, all crown buttons disable with the disabled state spec
  Tie button, visually separated by ml-auto:
    border-dashed border-[var(--border-default)]
    text-[var(--text-secondary)]
    Label: "CALL IT A TIE"
```

### 11.5 Bench, unblind state

```
Reveal: each column flips with rotateY 90deg to 0deg, spring
  stiffness 260 damping 24, stagger 0.15s
  Letter tag crossfades to the real model name,
  font-mono text-xs uppercase tracking-[0.2em] text-[var(--text-primary)]
  Crowned column gains: border-[var(--accent)]
    shadow-[0_0_0_1px_var(--accent-glow)]
    plus the stamp, rotated -2deg:
    border-2 border-[var(--accent)] text-[var(--accent)]
    rounded-[var(--radius-sm)] px-3 py-1.5 font-mono text-xs
    uppercase tracking-[0.15em]
    Text: "YOUR PICK"

Ledger line: mt-8 pt-6 border-t border-[var(--border-subtle)]
  font-mono text-xs text-[var(--text-secondary)]
  Text: "RECORDED TO YOUR LEDGER. POLICY WEIGHTS SHIFTED."

Toast: bottom-6 right-6, slides in y 16 to 0, opacity 0 to 1, 0.25s,
  bg-[var(--bg-elevated)] border border-[var(--border-default)]
  rounded-lg px-4 py-3 shadow-[var(--shadow-md)]
  font-mono text-xs text-[var(--text-primary)]
  Text: "VERDICT SAVED"
  Auto-dismiss after 3s, exit 0.18s
```

### 11.6 History

```
Container: max-w-5xl mx-auto px-4 md:px-6 py-10

Header: font-display font-black uppercase text-2xl
  tracking-[-0.02em] mb-6
  Text: "LEDGER"

Rows: divide-y divide-[var(--border-subtle)]
  border-t border-[var(--border-subtle)]
  Row: grid grid-cols-12 items-center gap-4 py-4 cursor-pointer
    hover:bg-[var(--bg-surface)] transition-colors px-2 -mx-2
    rounded-[var(--radius-md)]
  Date: col-span-3 font-mono text-xs text-[var(--text-muted)]
  Workload excerpt: col-span-4 font-body text-sm
    text-[var(--text-primary)] truncate
  Winner: col-span-2 font-mono text-xs uppercase
    text-[var(--text-secondary)] or text-[var(--accent)] when crowned
  Cost: col-span-2 font-mono text-xs tabular-nums
    text-[var(--text-secondary)] text-right
  Chevron: col-span-1 inline SVG, text-[var(--text-muted)],
    group-hover:translate-x-1 transition-transform
  Below md the grid collapses to a two-row stack

Empty state: same dashed pattern as the bench,
  Title: "No verdicts yet"
  Body: "Your first blind trial takes about a minute."
  Action: "GO TO THE BENCH", switches tab

Detail view replaces the list with slide-in-from-right, the verdict
  and unblind states from 11.4 and 11.5 rendered read-only
```

### 11.7 Policy

```
Container: max-w-5xl mx-auto px-4 md:px-6 py-10

Header row: flex items-baseline justify-between mb-8
  Title: font-display font-black uppercase text-2xl tracking-[-0.02em]
    Text: "ROUTING POLICY"
  Version: font-mono text-xs text-[var(--text-muted)]
    Text: "V3 / 12 CROWNS"

Rank list: divide-y divide-[var(--border-subtle)]
  border-y border-[var(--border-subtle)]
  Row (x N): grid grid-cols-12 items-center gap-4 py-4
  Rank: col-span-1 font-mono text-xs text-[var(--text-muted)]
  Model: col-span-5 font-body text-sm text-[var(--text-primary)]
  Quality share bar: col-span-4, track h-1.5 rounded-[var(--radius-sm)]
    bg-[var(--bg-secondary)], fill bg-[var(--text-primary)],
    top-ranked fill bg-[var(--accent)]
  Value: col-span-2 font-mono text-xs tabular-nums
    text-[var(--text-secondary)] text-right

Locks table: mt-10
  Label: font-mono text-[11px] uppercase tracking-[0.2em]
    text-[var(--text-secondary)] mb-3
    Text: "LOCKS PER TASK TYPE"
  Rows (x5): grid grid-cols-4 gap-4 py-3
    border-b border-[var(--border-subtle)]
  Task: font-body text-sm text-[var(--text-primary)]
  Three selects, default, fallback, budget:
    bg-[var(--bg-surface)] border border-[var(--border-default)]
    rounded-[var(--radius-md)] px-3 py-2 font-mono text-xs
    text-[var(--text-primary)]
    focus:border-[var(--accent)]/50 outline-none

Export: mt-10, button-in-button pattern, full width on mobile
  Label: "EXPORT POLICY"
  On click: copies JSON to clipboard, toast "POLICY COPIED",
    resets after 1.8s to a check state then back
```

---

## 12. Responsive Summary

- Hero tile stacks below the CTA cluster under lg, full width, verdict flip retained
- Method specimen tiles drop to w-16 h-16 below md, connector hidden below lg
- Anatomy bento collapses to single column below lg, annotations hidden below lg
- Policy grid stacks with the art panel leading below lg, parallax disabled
- Final CTA wash strengthens below md, gradient holds 70 percent coverage
- All headline sizes step through three breakpoints minimum, clamp everywhere
- CalibrationField grid spacing drops to 36px below md, sweep unchanged
- Touch targets never below 44px, chips and tabs included

## 13. Accessibility Summary

- Every interactive element carries the focus-visible ring from 1.6
- Icon-only buttons carry aria-labels, crown buttons announce the letter
- Rubric bars pair colour with the numeric score, never colour alone
- Tab order follows visual order, tabs are real buttons with aria-current
- prefers-reduced-motion: CalibrationField static per 1.4, all blur-ins
  become opacity-only, parallax and the connector draw are disabled
- Contrast: ink on bench exceeds 12:1, secondary on bench exceeds 6:1,
  muted is used only for uppercase mono labels at 11px and above
- Live counters and timers carry aria-live off, the verdict arrival
  announces once via a polite live region

## 14. Asset Brief Summary

All art follows the Assay Bench series: cool grey bench surface, ink shadows, one red indicator accent, no warm cream, no logos, no people. The three approved samples in `art-direction/` are the reference anchors. Every asset ships two paths, pull or generate, and either must be graded to the samples. Final assets compress to under 500KB, WebP preferred.

| # | Asset | Section | Ratio | Pull keywords | Generate prompt seed |
|---|---|---|---|---|---|
| 1 | Knoll strip | Metrics | 21:9 | "knolling tools overhead", "calibration weights flat lay" | Sample 1 prompt, reseed composition |
| 2 | Caliper | Method 01 | 1:1 | "vernier caliper studio" | "Macro of a steel vernier caliper on cool grey bench, one red accent" |
| 3 | Stopwatch | Method 02 | 1:1 | "stopwatch studio shot" | "Macro of a mechanical stopwatch on cool grey bench, red second hand" |
| 4 | Prism | Method 03 | 1:1 | "glass prism white background" | Sample 3 prompt, square crop |
| 5 | Rail points | Method 04 | 1:1 | "railway points macro" | "Macro of steel rail points switching on a light bench surface, red signal lamp" |
| 6 | Beam balance | Policy | 4:3 | "beam balance studio" | "A precision beam balance mid-pivot on cool grey bench, red pointer at centre" |
| 7 | Gauge macro | Final CTA | 16:9 | "pressure gauge macro" | Sample 2 prompt, needle right of centre |

Pull path: Unsplash or Pexels first, Pixabay fallback, Adobe Stock if paid is acceptable. Reference path for palette adaptation: the approved samples attached as the visual source, keep subject and light, grade the surface to the bench palette. Pull, then adapt, or generate to match. Nothing ships ungraded.

## 15. Spec Self-Check (Rule 7)

- [x] Every element has exact Tailwind classes
- [x] Every animation has initial, animate, duration, ease and delay values
- [x] Every section declares its z-index position against the global map
- [x] Every section needing imagery has an asset brief with dual sourcing paths
- [x] Every positional or sizing class carries responsive breakpoints
- [x] Composition recipes referenced by name where matches exist, bespoke specs at matching detail where none did
- [x] No placeholder copy, every headline, subhead, label and button is final text
- [x] All data shown in the anatomy and metrics sections is bound to real recorded trials, with an explicit removal rule rather than an estimate rule
- [x] Every scroll animation replays, viewport once false, amount 0.1, zero exceptions
- [x] Entrances use blur-in, exits shorter than enters, springs on interactive elements
