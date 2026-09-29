/**
 * The document root.
 *
 * The grain overlay mounts once here, the CalibrationField mounts once here and
 * the morph pill mounts once here. Nothing else is global.
 */

import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import CalibrationField from '@/components/canvas/CalibrationField'
import MorphNav from '@/components/layout/MorphNav'
import { GrainOverlay } from '@/components/primitives'
import { SectionDensityProvider } from '@/hooks/useSectionDensity'
import '@/styles/globals.css'

/** The page metadata. */
export const metadata: Metadata = {
  // The stable project alias. Every production deploy gets its own random
  // subdomain, so anything meant to be permanent points here.
  metadataBase: new URL('https://assay-psycho-projects.vercel.app'),
  title: 'Assay, the blind trial for your model stack',
  description:
    'Paste a real workload, run it across every model you already pay for with the names stripped, and get a blind verdict on quality, token cost and latency. Crown a winner before the reveal.',
  openGraph: {
    title: 'Assay, the blind trial for your model stack',
    description:
      'One real workload, every model on trial, names sealed until the verdict lands. Runs on Anna OS.',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Assay, the blind trial for your model stack',
    description: 'Your prompt is the benchmark now.',
    creator: '@xoxo_psychoo',
  },
  // metadataBase on its own does not emit a canonical link, it only resolves
  // relative URLs. Without this every deploy URL becomes its own canonical.
  alternates: { canonical: '/' },
}

/** The viewport, light bench, no browser chrome tint. */
export const viewport: Viewport = {
  themeColor: '#edf0ec',
  colorScheme: 'light',
}

/**
 * Wraps every page.
 * @param children The page tree.
 * @returns The document element.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bench-primary font-body text-ink-primary antialiased">
        <SectionDensityProvider>
          <CalibrationField />
          <GrainOverlay />
          <MorphNav />
          {children}
        </SectionDensityProvider>
      </body>
    </html>
  )
}
