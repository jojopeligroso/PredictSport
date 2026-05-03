# MVP Specification

## MVP Philosophy

**Reduce admin friction.** The biggest problem with the current PDF format is that one person has to maintain everything manually. The app must automate as much as possible — especially result ingestion — so running a competition is nearly zero-effort.

**Support multiple groups.** Different friend groups, clubs, or workplaces should each be able to run their own competitions independently. A user can be in multiple competitions.

**Full prediction type system.** The PDF only uses "pick the winner", but the app should support all prediction types from the start. This is core product differentiation, not a nice-to-have.

**Engaging leaderboard.** This is where the fun lives. Make it worth checking daily.

## Competition Structure

- **Multiple groups supported.** Each competition is independent with its own admin, participants, scoring rules, and events.
- **A user can be in multiple competitions simultaneously** with different roles in each.
- **Visibility:** Public (open join) or Private (invite only), set at creation.
- **Join methods:** Direct invite, shareable invite link (tokenised URL), or open join for public competitions.
- **Competition types:**
  - *Fixed* — all events defined at creation, locked set
  - *Open/Rolling* — events added throughout the lifetime (requires nominations or admin adding)
- **Co-admins:** Creator can appoint co-admins who share all powers except deleting the competition.

## Event Nominations

Participants can nominate sporting events for inclusion in a competition:

1. Any participant submits a nomination (event name, sport, date, suggested prediction type)
2. Competition admin receives notification
3. Admin approves (optionally modifying details), rejects (with optional reason), or ignores
4. Approved events appear in the competition; nominator is notified
5. Rejected nominations notify the nominator with the reason

This keeps competitions fresh and reduces the burden on the admin to think of every event.

## MVP Pages

### Page 1: My Predictions / Home
- List of all events in the active competition
- User's predictions inline (editable if not yet locked)
- Colour coding: correct (green), wrong (red), partial (amber), pending (grey), locked-awaiting-result (neutral)
- Lock countdown for upcoming events
- Submit/edit predictions directly on this page
- Filter by sport, status, date

### Page 2: Leaderboard
- Rank, name, total points, correct/partial/wrong counts, accuracy %
- Expandable rows to see each person's predictions vs correct answers
- Tiebreaker value shown for tied scores
- Visual flair — position changes, streaks, momentum indicators
- Competition selector if user is in multiple competitions

### Page 3: Admin Panel
- Add/edit events for the competition
- Enter or confirm results (one-click confirm for API-fetched results)
- Review event nominations (approve/reject)
- Manage participants and co-admins
- Invite link management
- Scoring rule configuration (at creation only)

### Auth
- Google OAuth via Supabase
- Invite link to join a competition (share in WhatsApp/wherever)

## WhatsApp Integration

Use the **WhatsApp Cloud API** (official Meta API). Free tier: 1,000 service conversations/month.

**Notifications:**
- "New competition created — join here: [link]"
- "Reminder: [Event] locks in 24 hours — submit your prediction!"
- "Result confirmed: [Event] — [Answer]. Leaderboard updated!"
- Weekly/monthly leaderboard summary
- "New event nominated by [User] — review it"

**Requirements:**
- WhatsApp Business Account (free)
- A dedicated phone number for the bot
- Users opt in by messaging the bot first (WhatsApp policy)

**If WhatsApp adds too much friction to initial build:** ship with in-app notifications first, add WhatsApp as a fast follow.
