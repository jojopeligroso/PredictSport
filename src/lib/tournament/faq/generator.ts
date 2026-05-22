/**
 * Dynamic FAQ Generator
 *
 * Generates tournament-specific FAQ content based on template configuration.
 * Works for any tournament (WC 2026, Euros, GAA, etc.).
 *
 * FAQs are dynamically built from:
 * - Template structure (groups, knockouts, tiebreakers)
 * - Classification types (R32, bracket, champion)
 * - Sport-specific terminology
 */

import { TournamentTemplate } from '../bracket/templates/types'
import { getR32ClassificationExplanation } from '../scoring/stage-pick'

export interface FAQItem {
  question: string
  answer: string
  category: 'basics' | 'scoring' | 'rules' | 'technical'
}

export interface FAQSection {
  title: string
  items: FAQItem[]
}

/**
 * Generate complete FAQ for a tournament
 *
 * @param template - Tournament template
 * @param competitionName - Display name (e.g., "FIFA World Cup 2026")
 * @returns Categorized FAQ sections
 */
export function generateTournamentFAQ(
  template: TournamentTemplate,
  competitionName: string
): FAQSection[] {
  const sections: FAQSection[] = [
    {
      title: 'Basics',
      items: generateBasicsFAQ(template, competitionName),
    },
    {
      title: 'Scoring & Classifications',
      items: generateScoringFAQ(template, competitionName),
    },
    {
      title: 'Rules & Tiebreakers',
      items: generateRulesFAQ(template, competitionName),
    },
    {
      title: 'Technical',
      items: generateTechnicalFAQ(template, competitionName),
    },
  ]

  return sections
}

/**
 * Generate basics FAQ items
 */
function generateBasicsFAQ(
  template: TournamentTemplate,
  competitionName: string
): FAQItem[] {
  const items: FAQItem[] = []

  // Q: What is Full Bracket?
  items.push({
    question: `What is the ${competitionName} Full Bracket?`,
    answer: `
The Full Bracket is your complete pre-tournament prediction where you predict:

1. **All group stage matches** - Score predictions for every match${template.groups ? ` across all ${template.groups.count} groups` : ''}
2. **Knockout stage progression** - Which teams advance through each round
3. **Tournament champion** - Your final winner prediction

Your predictions are locked before the tournament starts, creating a complete bracket that plays out as the tournament progresses.
    `.trim(),
    category: 'basics',
  })

  // Q: How does the group stage work?
  if (template.groups) {
    const { count, teamsPerGroup, advancePerGroup } = template.groups

    const advancementText = advancePerGroup
      .map((rule) => {
        if (rule.position === 1) return `All ${rule.count} group winners`
        if (rule.position === 2) return `All ${rule.count} runners-up`
        if (rule.position === 3)
          return `Best ${rule.conditions?.selectTop || rule.count} third-place teams`
        return ''
      })
      .filter(Boolean)
      .join('\n- ')

    items.push({
      question: 'How does the group stage work?',
      answer: `
The tournament has ${count} groups with ${teamsPerGroup} teams each.

**Who advances:**
- ${advancementText}

**How to predict:**
1. Select a group
2. Predict all ${(teamsPerGroup * (teamsPerGroup - 1)) / 2} match scores
3. We automatically calculate standings using official tiebreaker rules
4. Repeat for all ${count} groups

Your group predictions determine which teams fill the knockout bracket.
      `.trim(),
      category: 'basics',
    })
  }

  // Q: What are the knockout stages?
  items.push({
    question: 'What are the knockout stages?',
    answer: `
After groups, teams progress through single-elimination knockout rounds:

${template.knockoutStages
  .map((stage, index) => {
    const advancement = stage.advancesTo
      ? ` → advances to ${template.knockoutStages.find((s) => s.id === stage.advancesTo)?.name || stage.advancesTo}`
      : ' (tournament ends)'
    return `${index + 1}. **${stage.name}** - ${stage.matchCount} ${stage.matchCount === 1 ? 'match' : 'matches'}${advancement}`
  })
  .join('\n')}

For each match, you simply pick the winner (no score prediction needed in knockouts).
    `.trim(),
    category: 'basics',
  })

  // Q: When can I make/change predictions?
  items.push({
    question: 'When can I make or change predictions?',
    answer: `
**Before tournament starts:**
- You can create, edit, and delete your Full Bracket freely
- Save your progress at any time (checkpoint system)

**Once tournament starts:**
- Your bracket is locked and cannot be changed
- You'll see a "Lock Time" countdown before each deadline
- Late submissions are not accepted

**Tip:** Save early, refine later. The system auto-saves your progress.
    `.trim(),
    category: 'basics',
  })

  return items
}

/**
 * Generate scoring FAQ items
 */
function generateScoringFAQ(
  template: TournamentTemplate,
  competitionName: string
): FAQItem[] {
  const items: FAQItem[] = []

  // Q: What is R32 Classification?
  if (template.stagePickClassifications?.r32) {
    const config = template.stagePickClassifications.r32
    const explanation = getR32ClassificationExplanation(template)

    items.push({
      question: 'What is R32 Classification?',
      answer: explanation,
      category: 'scoring',
    })

    // Q: How is R32 Classification scored?
    const totalQualifiers = template.groups?.advancePerGroup.reduce(
      (sum, rule) => sum + rule.count,
      0
    )

    items.push({
      question: 'How is R32 Classification scored?',
      answer: `
**Scoring:**
- ${config.pointsPerCorrectTeam} point per team you correctly predicted to reach the knockout stage
- Maximum: ${(totalQualifiers || 32) * config.pointsPerCorrectTeam} points (if you predict all ${totalQualifiers} teams correctly)
- Path-insensitive: doesn't matter which bracket slot, just whether they qualified

**Example:**
- You predict France, Brazil, and Argentina to advance
- Actual results: France and Brazil advance, Argentina doesn't
- You score: ${config.pointsPerCorrectTeam * 2} points (66% accuracy)

**Why path-insensitive?**
The R32 Classification only cares IF a team made the knockouts, not which group they finished in or who they play. This is a separate classification from the Knockout Bracket (coming in Phase 2).
      `.trim(),
      category: 'scoring',
    })
  }

  // Q: What classifications are available?
  items.push({
    question: `What predictions and classifications are in ${competitionName}?`,
    answer: `
**Phase 1 (Current):**
1. **Full Bracket** - Complete pre-tournament predictions (all groups + knockouts)
2. **R32 Classification** - Automatic: how many knockout teams did you predict? (${template.stagePickClassifications?.r32?.pointsPerCorrectTeam || 1} point per team)
3. **Champion Prediction** - Outright winner pick (fun bonus)

**Phase 2 (Future):**
4. **Knockout Bracket Classification** - Exact bracket accuracy (path-sensitive scoring)
5. **Additional stage picks** - R16, QF, SF accuracy classifications

R32 Classification is automatic — no extra work required. Just predict group matches and we handle the rest.
    `.trim(),
    category: 'scoring',
  })

  // Q: Can I see my score before tournament ends?
  items.push({
    question: 'Can I see my score before the tournament ends?',
    answer: `
**During tournament:**
- R32 Classification score visible after group stage completes
- You'll see which teams you predicted correctly
- Leaderboard updates in real-time

**After tournament:**
- Full scoring breakdown available
- Compare your bracket vs actual results
- See where you gained/lost points

Your score is calculated automatically as matches are confirmed. No manual scoring required.
    `.trim(),
    category: 'scoring',
  })

  return items
}

/**
 * Generate rules FAQ items
 */
function generateRulesFAQ(
  template: TournamentTemplate,
  competitionName: string
): FAQItem[] {
  const items: FAQItem[] = []

  // Q: How are group standings calculated?
  if (template.groups) {
    const tiebreakerList = template.tiebreakers
      .filter((rule) => rule.type !== 'random')
      .map((rule, index) => {
        const labels: Record<string, string> = {
          head_to_head_points: 'Head-to-head points',
          head_to_head_gd: 'Head-to-head goal difference',
          head_to_head_gs: 'Head-to-head goals scored',
          overall_gd: 'Overall goal difference',
          overall_gs: 'Overall goals scored',
          tries_scored: 'Tries scored (rugby)',
          fair_play: 'Fair play score (yellow/red cards)',
          ranking: 'FIFA world ranking',
        }
        return `${index + 1}. ${labels[rule.type] || rule.type}`
      })
      .join('\n')

    items.push({
      question: 'How are group standings calculated?',
      answer: `
**Points system:**
- Win: 3 points
- Draw: 1 point
- Loss: 0 points

**When teams are level on points, tiebreakers are applied in order:**

${tiebreakerList}

**Random fallback:**
If all tiebreakers are exhausted (rare!), teams are separated randomly. To avoid this, predict different scores in your group matches.

Phase 2 will add fair play and ranking tiebreakers for more accurate simulation.
      `.trim(),
      category: 'rules',
    })
  }

  // Q: What if I predict an exact tie?
  items.push({
    question: 'What if I predict an exact tie in the standings?',
    answer: `
If your predictions create an exact tie (e.g., two teams with identical points, goal difference, and goals scored), the system will:

1. Try all configured tiebreakers in order
2. If still tied after all tiebreakers, teams are randomly separated
3. You'll see a warning: "⚠️ Exact tie detected — randomly placed"

**How to avoid:**
Predict slightly different scores so tiebreakers can resolve naturally. For example:
- Instead of: France 2-0, Spain 2-0 (tied GD and GS)
- Try: France 2-0, Spain 3-1 (different GS breaks tie)

This makes your bracket more realistic and avoids random placement.
    `.trim(),
    category: 'rules',
  })

  // Q: Best third allocation
  if (
    template.groups?.advancePerGroup.some(
      (rule) => rule.position === 3 && (rule.conditions?.selectTop || rule.count) < 12
    )
  ) {
    const bestThirdCount =
      template.groups.advancePerGroup.find((r) => r.position === 3)?.conditions
        ?.selectTop || 8

    items.push({
      question: `How are the best ${bestThirdCount} third-place teams selected?`,
      answer: `
Third-place teams from all groups are ranked against each other using the same tiebreaker rules:

1. Points
2. Goal difference
3. Goals scored
4. (Additional tiebreakers if needed)

The top ${bestThirdCount} third-place teams advance to the knockout stage.

**Note:** Head-to-head tiebreakers are skipped (teams from different groups didn't play each other). Only overall stats are compared.

**Bracket slots:**
The best third-place teams are allocated to specific R32 matches according to official tournament rules. This happens automatically — you don't choose their bracket positions.
      `.trim(),
      category: 'rules',
    })
  }

  return items
}

/**
 * Generate technical FAQ items
 */
function generateTechnicalFAQ(
  template: TournamentTemplate,
  competitionName: string
): FAQItem[] {
  const items: FAQItem[] = []

  // Q: How does the checkpoint system work?
  items.push({
    question: 'How does the save/checkpoint system work?',
    answer: `
Your Full Bracket predictions are saved automatically at key checkpoints:

**Checkpoints:**
1. After completing each group
2. After completing all groups (R32 qualifiers determined)
3. After each knockout stage
4. Final submission

**Benefits:**
- Resume where you left off if you close the browser
- No data loss if session expires
- Review and edit saved groups before final submission

**Important:** Your bracket isn't locked until you complete final submission AND tournament starts. Save early, finalize when ready.
    `.trim(),
    category: 'technical',
  })

  // Q: What data is stored?
  items.push({
    question: 'What data is stored in my bracket?',
    answer: `
Your Full Bracket contains:

**Group stage:**
${template.groups ? `- ${template.groups.count} groups with all match predictions` : '- All group match predictions'}
- Match scores (home/away)
${template.tiebreakers.some((t) => t.type === 'tries_scored') ? '- Tries scored (rugby)\n' : ''}- Automatically calculated standings

**Knockout stage:**
- Winner picks for each match
- Progression through all rounds

**Metadata:**
- Submission timestamp
- Lock status
- Version history (if updated before lock)

All stored in your competition entry as JSONB. Efficient, versioned, and secure.
    `.trim(),
    category: 'technical',
  })

  // Q: Can I delete my bracket?
  items.push({
    question: 'Can I delete my bracket and start over?',
    answer: `
**Before lock time:**
Yes! You can delete your entire bracket and start fresh at any time.

**After lock time:**
No. Once the tournament starts, your bracket is locked permanently. This ensures fairness and prevents retroactive changes.

**Tip:** Use the checkpoint system to save progress without final submission. Review all predictions carefully before final lock.
    `.trim(),
    category: 'technical',
  })

  // Q: What if a match is postponed?
  items.push({
    question: 'What happens if a match is postponed or cancelled?',
    answer: `
**During group stage:**
- Admin will update match times
- Your predictions remain valid
- Standings recalculated when match completes

**During knockout stage:**
- Winner selection carries forward to new match time
- No re-prediction needed

**Cancelled matches:**
- Admin marks match as void
- Affected predictions receive null score (no points gained/lost)
- Alternative tiebreakers may apply

You'll receive notifications if any of your predicted matches are affected.
    `.trim(),
    category: 'technical',
  })

  return items
}

/**
 * Search FAQ items by keyword
 *
 * @param sections - All FAQ sections
 * @param query - Search query
 * @returns Matching FAQ items
 */
export function searchFAQ(sections: FAQSection[], query: string): FAQItem[] {
  const lowerQuery = query.toLowerCase()

  const matches: FAQItem[] = []

  sections.forEach((section) => {
    section.items.forEach((item) => {
      const questionMatch = item.question.toLowerCase().includes(lowerQuery)
      const answerMatch = item.answer.toLowerCase().includes(lowerQuery)

      if (questionMatch || answerMatch) {
        matches.push(item)
      }
    })
  })

  return matches
}

/**
 * Get FAQ items by category
 */
export function getFAQByCategory(
  sections: FAQSection[],
  category: FAQItem['category']
): FAQItem[] {
  return sections.flatMap((section) =>
    section.items.filter((item) => item.category === category)
  )
}

/**
 * Format FAQ as plain text (for AI/chatbot)
 */
export function formatFAQAsText(sections: FAQSection[]): string {
  return sections
    .map((section) => {
      const items = section.items
        .map((item) => {
          return `Q: ${item.question}\nA: ${item.answer}\n`
        })
        .join('\n')

      return `# ${section.title}\n\n${items}`
    })
    .join('\n\n---\n\n')
}
