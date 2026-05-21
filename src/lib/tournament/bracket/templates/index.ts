/**
 * Tournament Template Registry
 *
 * Central registry of all available tournament templates.
 * Add new tournaments here as they're implemented.
 */

import { TournamentTemplate, TemplateRegistry } from './types'
import { FIFA_WC_2026_TEMPLATE } from '../adapters/fifa-world-cup-2026'

export const TOURNAMENT_TEMPLATES: TemplateRegistry = {
  'fifa-world-cup-2026': FIFA_WC_2026_TEMPLATE,
  // Future templates:
  // 'uefa-euro-2024': UEFA_EURO_2024_TEMPLATE,
  // 'gaa-all-ireland-2026': GAA_ALL_IRELAND_2026_TEMPLATE,
}

/**
 * Get tournament template by ID
 */
export function getTemplate(templateId: string): TournamentTemplate | null {
  return TOURNAMENT_TEMPLATES[templateId] || null
}

/**
 * Get all available templates
 */
export function getAllTemplates(): TournamentTemplate[] {
  return Object.values(TOURNAMENT_TEMPLATES)
}

/**
 * Get templates for a specific sport
 */
export function getTemplatesBySport(sport: string): TournamentTemplate[] {
  return getAllTemplates().filter((t) => t.sport === sport)
}
