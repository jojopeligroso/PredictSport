import { Metadata } from 'next'
import BracketTestClient from './BracketTestClient'

export const metadata: Metadata = {
  title: 'Bracket Test - WC 2026',
  description: 'Test page for W/D/L bracket prediction flow',
}

/**
 * Test page for new W/D/L bracket flow
 *
 * Route: /wc/bracket/test
 *
 * Tests:
 * - Group results prediction (W/D/L)
 * - Smart tiebreaker detection
 * - Inline score collection
 * - Third-place ranking
 * - Auto-save functionality
 */
export default function BracketTestPage() {
  return <BracketTestClient />
}
