# PredictSport - TODO

## Scoring Template Redesign (HIGH PRIORITY)

The current scoring template UI is too simplistic. Each template needs:
- Clear explanation of how it works in practice
- Example scenarios showing how points are awarded
- Visual distinction between templates

### Templates to improve:

**Classic Quiz**
- 10pts correct, 20pts dual questions, 10pts partial
- Needs: explain what "dual questions" means, show example of partial credit

**Tournament**
- 10pts winner, 5pts top 5, 3pts top 10
- Needs: explain this is for predicting tournament outcomes (e.g. golf majors, World Cup)

**Weekly Fixtures**
- 3pts correct result, 1pt correct draw
- Needs: explain this is for predicting match results across a gameweek

**Head to Head Series**
- 5pts per correct H2H, bonus for clean sweep
- Needs: explain the "clean sweep" bonus, show how series scoring works

**Custom**
- "Define your own scoring" is too vague
- Needs: guided builder with contextual help, not just raw number inputs

### Design goals:
- User should immediately understand what each template is FOR (what type of competition)
- Show concrete examples inline (e.g. "If you pick Team A to win and they do: +3pts")
- Custom should feel like a power-user option, not a confusing spreadsheet

## WhatsApp Integration

- Notification channel (not input for MVP)
- WhatsApp Cloud API (Meta) — 1,000 free service conversations/month
- Notifications: reminders before lock, result confirmations, leaderboard updates, invite links
- Requires: WhatsApp Business Account, dedicated phone number, user opt-in

## Sports Data

- TheSportsDB — primary for most sports
- Foireann — investigate for GAA results (no public API known, may need scraping)
- Manual entry — fallback for everything else
