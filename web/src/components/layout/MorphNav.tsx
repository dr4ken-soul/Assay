/**
 * The A2 scroll-morph pill.
 *
 * A full transparent bar over the hero, collapsing past 80 pixels of scroll
 * into a centred floating pill. The collapse is a shared layout element, so the
 * bar physically becomes the pill rather than cross-fading into one.
 *
 * Below `lg` the centre links are withdrawn and a hamburger opens a drawer.
 */

'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

/** The scroll distance at which the bar morphs. */
const MORPH_AT = 80

/** The centre links, hidden below lg. */
const LINKS = [
  { href: '#method', label: 'THE METHOD' },
  { href: '#anatomy', label: 'ANATOMY' },
  { href: '#policy', label: 'POLICY' },
]

/** The drawer rows, a superset of the centre links. */
const DRAWER_LINKS = [
  { href: '#method', label: 'THE METHOD' },
  { href: '#anatomy', label: 'ANATOMY' },
  { href: '#policy', label: 'POLICY' },
  { href: 'https://anna.partners', label: 'OPEN IN ANNA', external: true },
  { href: 'https://github.com/dr4ken-soul/Assay', label: 'GITHUB', external: true },
  { href: 'https://x.com', label: 'X', external: true },
]

/**
 * Scrolls to an in-page anchor.
 * @param href The anchor href, with the hash.
 * @returns Nothing.
 */
function scrollTo(href: string): void {
  const target = document.querySelector(href)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * The navigation.
 * @returns The nav element.
 */
export default function MorphNav() {
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > MORPH_AT)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const cta = (
    <a
      href="https://anna.partners"
      target="_blank"
      rel="noreferrer noopener"
      className="focus-ring rounded-full bg-ink-primary px-5 py-2.5 font-mono text-xs uppercase tracking-[0.08em] text-bench-elevated transition-colors duration-200 hover:bg-indicator hover:text-white"
    >
      OPEN IN ANNA
    </a>
  )

  return (
    <>
      <motion.header
        layoutId="assay-nav-pill"
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className={
          collapsed
            ? 'fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-6 rounded-full border border-line bg-bench-elevated/90 px-5 py-2.5 shadow-md backdrop-blur-xl'
            : 'fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between px-6 md:px-10'
        }
      >
        <a
          href="#top"
          onClick={(event) => {
            event.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="focus-ring flex items-baseline"
        >
          <span className="font-display text-xl font-black tracking-[-0.02em] text-ink-primary">ASSAY</span>
          {!collapsed ? (
            <span className="ml-3 hidden font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted md:inline">
              BLIND TRIALS
            </span>
          ) : null}
        </a>

        {!collapsed ? (
          <>
            <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(event) => {
                    event.preventDefault()
                    scrollTo(link.href)
                  }}
                  className="focus-ring font-mono text-xs uppercase tracking-[0.15em] text-ink-secondary transition-colors duration-200 hover:text-indicator"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            {cta}
          </>
        ) : (
          <>
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            {cta}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open the menu"
              aria-expanded={open}
              className="focus-ring flex h-8 w-8 flex-col items-center justify-center gap-[5px] lg:hidden"
            >
              <span className="h-[2px] w-5 bg-ink-primary" />
              <span className="h-[2px] w-5 bg-ink-primary" />
              <span className="h-[2px] w-5 bg-ink-primary" />
            </button>
          </>
        )}
      </motion.header>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close the menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[45] cursor-default bg-ink-primary/20 backdrop-blur-sm"
            />
            <motion.nav
              aria-label="Menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="fixed right-0 top-0 z-40 h-full w-[82vw] max-w-[320px] border-l border-line bg-bench-surface px-8 py-10"
            >
              <p className="font-display text-lg font-black tracking-[-0.02em] text-ink-primary">ASSAY</p>
              <div className="mt-8 flex flex-col">
                {DRAWER_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noreferrer noopener' : undefined}
                    onClick={(event) => {
                      if (link.external) return
                      event.preventDefault()
                      setOpen(false)
                      scrollTo(link.href)
                    }}
                    className="focus-ring border-b border-line-subtle py-4 font-mono text-sm uppercase tracking-[0.15em] text-ink-primary transition-colors duration-200 hover:text-indicator"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </motion.nav>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
