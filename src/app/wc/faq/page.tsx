import { Metadata } from 'next'
import Link from 'next/link'
import { generateTournamentFAQ, FAQSection } from '@/lib/tournament/faq/generator'
import { getTemplate } from '@/lib/tournament/bracket/templates'

export const metadata: Metadata = {
  title: 'Full Bracket FAQ - FIFA World Cup 2026',
  description:
    'Frequently asked questions about Full Bracket predictions, R32 Classification, scoring, and tiebreakers for FIFA World Cup 2026.',
}

/**
 * FAQ Page for FIFA World Cup 2026 Full Bracket
 *
 * Dynamically generated from tournament template.
 * Explains how Full Bracket works, R32 Classification, scoring, and rules.
 */
export default function WCFAQPage() {
  const template = getTemplate('fifa-world-cup-2026')

  if (!template) {
    return (
      <div className="min-h-screen bg-ps-cream px-4 py-8">
        <div className="mx-auto max-w-[480px]">
          <p className="text-ps-ink">Tournament template not found.</p>
          <Link href="/wc" className="mt-4 text-ps-amber underline">
            ← Back to World Cup
          </Link>
        </div>
      </div>
    )
  }

  const faqSections = generateTournamentFAQ(template, 'FIFA World Cup 2026')

  return (
    <div className="min-h-screen bg-ps-cream px-4 py-8">
      <div className="mx-auto max-w-[480px]">
        {/* Header */}
        <header className="mb-8">
          <Link
            href="/wc"
            className="mb-4 inline-block text-sm text-ps-ink/60 hover:text-ps-ink"
          >
            ← Back to World Cup
          </Link>

          <h1 className="font-display text-3xl font-extrabold text-ps-ink">
            Full Bracket FAQ
          </h1>
          <p className="mt-2 text-ps-ink/80">
            Everything you need to know about FIFA World Cup 2026 Full Bracket
            predictions, R32 Classification, and scoring.
          </p>
        </header>

        {/* Quick Links */}
        <nav className="mb-8 rounded-lg border border-ps-ink/10 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-ps-ink">Jump to:</p>
          <ul className="space-y-1 text-sm">
            {faqSections.map((section) => (
              <li key={section.title}>
                <a
                  href={`#${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-ps-amber hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* FAQ Sections */}
        <div className="space-y-12">
          {faqSections.map((section) => (
            <FAQSectionComponent key={section.title} section={section} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 rounded-lg border border-ps-amber/20 bg-ps-amber/5 p-6">
          <h2 className="mb-2 font-display text-xl font-extrabold text-ps-ink">
            Ready to predict?
          </h2>
          <p className="mb-4 text-sm text-ps-ink/80">
            Create your Full Bracket and compete for R32 Classification glory.
          </p>
          <Link
            href="/wc/bracket"
            className="inline-block rounded-lg bg-ps-amber px-6 py-3 font-semibold text-ps-ink transition-all hover:bg-ps-amber/90 hover:shadow-md"
          >
            Start Full Bracket →
          </Link>
        </div>

        {/* Still have questions? */}
        <div className="mt-8 text-center text-sm text-ps-ink/60">
          <p>
            Still have questions?{' '}
            <Link href="/contact" className="text-ps-amber hover:underline">
              Contact us
            </Link>{' '}
            or join our{' '}
            <Link href="/community" className="text-ps-amber hover:underline">
              community forum
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * FAQ Section Component
 *
 * Renders a section with collapsible Q&A items.
 */
function FAQSectionComponent({ section }: { section: FAQSection }) {
  return (
    <section
      id={section.title.toLowerCase().replace(/\s+/g, '-')}
      className="scroll-mt-8"
    >
      <h2 className="mb-6 font-display text-2xl font-extrabold text-ps-ink">
        {section.title}
      </h2>

      <div className="space-y-6">
        {section.items.map((item, index) => (
          <details
            key={index}
            className="group rounded-lg border border-ps-ink/10 bg-white p-4 transition-all hover:border-ps-ink/20"
          >
            <summary className="cursor-pointer font-semibold text-ps-ink marker:text-ps-amber">
              {item.question}
            </summary>

            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ps-ink/80">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
