/**
 * Section 8, the footer.
 *
 * Wordmark and attribution on the left, the four links on the right, and a
 * bottom row carrying the two mono facts.
 */

'use client'

import { Reveal } from '@/components/primitives'

/** The footer links. */
const LINKS = [
  { href: 'https://anna.partners', label: 'MARKETPLACE' },
  { href: 'https://github.com/dr4ken-soul/Assay', label: 'GITHUB' },
  { href: 'https://x.com', label: 'X' },
  { href: 'https://anna.partners/developers', label: 'DOCS' },
]

/**
 * The footer.
 * @returns The footer element.
 */
export default function Footer() {
  return (
    <footer data-density="dense" className="border-t border-line bg-bench-primary px-6 py-14 md:px-10">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Reveal>
            <div>
              {/* Logo slot: replace with public/logo.svg once provided */}
              <p className="font-display text-lg font-black tracking-[-0.02em] text-ink-primary">ASSAY</p>
              <p className="mt-3 font-body text-xs text-ink-muted">
                Built for the Anna AI App Builder Program, Founding Builder cohort
              </p>
            </div>
          </Reveal>

          <Reveal index={1}>
            <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer">
              {LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring font-mono text-xs uppercase tracking-[0.15em] text-ink-secondary transition-colors duration-200 hover:text-indicator"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </Reveal>
        </div>

        <div className="mt-10 flex justify-between border-t border-line-subtle pt-6 font-mono text-[11px] text-ink-muted">
          <span>© 2026 ASSAY</span>
          <span>RUNS ON ANNA OS</span>
        </div>
      </div>
    </footer>
  )
}
