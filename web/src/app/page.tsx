/**
 * The landing page.
 *
 * Eight sections in order, over one CalibrationField and one morph pill. The
 * page persists nothing: no cookie, no local storage, no session storage.
 */

import Anatomy from '@/components/sections/Anatomy'
import FinalCta from '@/components/sections/FinalCta'
import Footer from '@/components/sections/Footer'
import Hero from '@/components/sections/Hero'
import Method from '@/components/sections/Method'
import Metrics from '@/components/sections/Metrics'
import Policy from '@/components/sections/Policy'
import Statement from '@/components/sections/Statement'

/**
 * The page body.
 * @returns The eight sections, in order.
 */
export default function Page() {
  return (
    <main>
      <Hero />
      <Statement />
      <Method />
      <Anatomy />
      <Metrics />
      <Policy />
      <FinalCta />
      <Footer />
    </main>
  )
}
