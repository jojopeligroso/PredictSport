# App Copy Audit

All user-facing language in the sportspredict. app, organised by page/component.

---

## Landing Page (`/`)

**File:** `src/app/page.tsx`

| Copy | Type |
|------|------|
| `sports` `predict.` | Wordmark |
| Call it before the lads do. | Tagline |
| Get started | CTA button (x2) |
| How it works | Section heading |
| Join a group | Step 1 title |
| Your mate sends a link. You're in. No downloads, no sign-up forms — just Google and go. | Step 1 description |
| Make your picks | Step 2 title |
| Each round has a mix of fixtures across sports. Pick your winners before the deadline locks. | Step 2 description |
| Climb the table | Step 3 title |
| Points land as results come in. See where you stand, who called it, and who got it very wrong. | Step 3 description |
| For friend groups, not sportsbooks. | Explainer bold |
| No money changes hands. No odds. No algorithms. Just bragging rights, banter, and the cold satisfaction of being right. | Explainer secondary |
| Free. No app store required. | Bottom subtext |

---

## Dashboard (`/` when logged in)

**File:** `src/app/page.tsx`

| Copy | Type |
|------|------|
| Home | Page heading |
| No active competitions yet. | Empty state |
| Ask a mate for an invite link to get started. | Empty state guidance |
| Round {number} | Round label |
| {pickCount} of {evtCount} picked | Progress |
| All picked | Completed state |
| No active round | Inactive state |

---

## Metadata

**File:** `src/app/layout.tsx`

| Copy | Type |
|------|------|
| sportspredict. -- Call it, then rub it in Gerry Ramos' face. | Page title |
| Social sports prediction platform for friend groups | Meta description |
| sportspredict. | OG title |
| Call it, then rub it in Gerry Ramos' face. | OG description |

---

## Login Page (`/login`)

**File:** `src/app/login/page.tsx`

| Copy | Type |
|------|------|
| `sports` `predict.` | Wordmark |
| Call it, then rub it in Gerry Ramos' face. | Tagline |
| Authentication failed. Please try again. | Error message |
| By signing in you agree to our Terms and Privacy Policy. | Legal text |
| Terms | Link |
| Privacy Policy | Link |

---

## Login Button

**File:** `src/components/LoginButton.tsx`

| Copy | Type |
|------|------|
| Continue with Google | Button |
| Redirecting... | Loading state |
| or | Divider |
| Email address | Placeholder |
| Send magic link | Button |
| Sending... | Loading state |
| Please enter your email address | Validation |
| Check your email for a login link | Success message |

---

## Join Page (`/join`)

**File:** `src/app/join/page.tsx`

| Copy | Type |
|------|------|
| Sign in to join | Subtitle |
| You've been invited to put your money where your mouth is. Without the money. Sign in to join. | Invite text |

**File:** `src/app/join/join-card.tsx`

| Copy | Type |
|------|------|
| {memberCount} member/members | Subtitle |
| You're in -- ready to start calling it with the group? | Confirmation |
| Yes, join | Button |
| No thanks | Button |
| Joining... | Loading state |
| This invite link is invalid or has been revoked. | Error |
| This invite link has expired. | Error |
| This invite link has reached its maximum uses. | Error |

---

## Telegram Login (`/telegram`)

**File:** `src/app/telegram/page.tsx`

| Copy | Type |
|------|------|
| `sports` `predict.` | Wordmark |
| Call it, then rub it in Gerry Ramos' face. | Tagline |

---

## NavBar

**File:** `src/components/NavBar.tsx`

| Copy | Type |
|------|------|
| `sports` `predict.` | Logo |
| Predictions | Nav link |
| Table | Nav link |
| Admin | Nav link (admin only) |
| Log in | Link |

---

## Mobile Nav

**File:** `src/components/MobileNav.tsx`

| Copy | Type |
|------|------|
| My Predictions | Link |
| Leaderboard | Link |
| Admin | Link (admin only) |
| Profile | Link |
| Log in | Link |

---

## User Menu

**File:** `src/components/UserMenu.tsx`

| Copy | Type |
|------|------|
| Profile | Link |

**File:** `src/components/LogoutButton.tsx`

| Copy | Type |
|------|------|
| Log out | Button |

---

## Footer

**File:** `src/components/Footer.tsx`

| Copy | Type |
|------|------|
| `sports` `predict.` | Wordmark |
| Built for bragging rights, not betting slips. | Tagline |
| Privacy | Link |
| Terms | Link |

---

## Auth Required

**File:** `src/components/AuthRequired.tsx`

| Copy | Type |
|------|------|
| Sign in required | Heading |
| You need to be signed in to access this page. | Description |
| Sign in to call it | Button |

---

## Predictions Page (`/predictions`)

**File:** `src/app/predictions/page.tsx`

| Copy | Type |
|------|------|
| My Predictions | Page heading |
| Submit your predictions before each event locks. | Subtext |
| Failed to load competitions. Please try again later. | Error |
| You haven't joined any competitions yet. | Empty state |
| Ask a friend for an invite link, or join a public competition to get started. | Guidance |
| Competition not found. Select a different one above. | Error |
| Failed to load events. Please try again later. | Error |

---

## Event List

**File:** `src/app/predictions/event-list.tsx`

### Hero / Round Info
| Copy | Type |
|------|------|
| THE ROUND | Label |
| Round {number} | Round indicator |
| {pickedCount} of {upcomingEvents.length} picked | Progress |
| Locks {time} | Time indicator |
| All locked | Lock status |

### Tabs
| Copy | Type |
|------|------|
| The Round | Tab label |
| Results | Tab label |

### Filter Chips
| Copy | Type |
|------|------|
| All | Filter |
| Open | Filter |
| Locked | Filter |

### Empty States
| Copy | Type |
|------|------|
| No events in this competition yet. Check back later. | Empty state |
| No events match the selected filter. | Filter empty state |
| No results yet -- check back once events start resolving. | Results empty state |

### Status Badges
| Copy | Type |
|------|------|
| upcoming | Badge |
| locked | Badge |
| resulted | Badge |
| postponed | Badge |
| cancelled | Badge |

### Missed Pick Lines (rotates per event)
| Copy |
|------|
| Gone. Didn't fancy it? |
| Too slow. |
| That ship has sailed. |
| Deadline waits for nobody. |
| Missed the boat on this one. |
| No pick, no points. |
| Clock ran out. |
| Sat this one out, whether you meant to or not. |

### Results Section
| Copy | Type |
|------|------|
| Last Round | Section label |
| RESULTS | Heading |
| You | Score label |

---

## Event Detail (`/predictions/[eventId]`)

**File:** `src/app/predictions/[eventId]/EventDetail.tsx`

### Hero
| Copy | Type |
|------|------|
| {sportEmoji} {sportName} | Sport label |
| {competitionName} | Subtitle |

### Lock Indicator
| Copy | Type |
|------|------|
| Locked | Label |
| Locks in | Label |
| LOCKED | Status |
| worth | Text |
| +{totalPoints} PTS | Points badge |

### Pick Section Labels
| Copy | Type |
|------|------|
| Your Pick . Winner | Label |
| Your Pick . Over/Under | Label |
| Your Pick . Head to Head | Label |
| Your Pick . Yes/No | Label |
| Your Pick . Top N | Label |
| Your Pick . How Far? | Label |
| Your Pick . Handicap | Label |
| Your Pick . Winning Margin | Label |
| Your Pick . Final Standings | Label |

### CTA
| Copy | Type |
|------|------|
| Locking it in... | Loading |
| Lock it in | Button |
| Pick to continue | Disabled state |
| You can change your pick until kickoff. | Help text |

### Community
| Copy | Type |
|------|------|
| The Lads' Picks . {totalPicks} in | Section header |

### Intel Report
| Copy | Type |
|------|------|
| Intel Report | Section header |
| The inside word from the group's resident expert. | Description |

---

## Prediction Form

**File:** `src/app/predictions/prediction-form.tsx`

### Type Labels
| Copy | Type |
|------|------|
| Pick the Winner | Label |
| Yes or No | Label |
| Top {N} Finishers | Label |
| Predict the Top {N} | Label |
| Head to Head | Label |
| Margin of Victory | Label |
| Over/Under {threshold} | Label |
| Handicap {handicap} | Label |
| How Far Will They Go? | Label |

### Placeholders
| Copy | Type |
|------|------|
| e.g. Scheffler, Liverpool, Hamilton | Text input |
| Who finishes in the top {N}? | Top N input |
| Winning margin (e.g. 7) | Margin input |

### Final Standings
| Copy | Type |
|------|------|
| Tap in order: 1st, 2nd, 3rd... | Instructions |
| Reset | Button |

### Validation Errors
| Copy | Type |
|------|------|
| Enter your prediction | Error |
| Make a selection | Error |
| Fill in all {N} positions | Error |
| Enter a valid number | Error |
| Select over or under | Error |
| Select a stage | Error |

### Submit States
| Copy | Type |
|------|------|
| Saving... | Loading |
| Update | Button (existing) |
| Submit | Button (new) |
| Saved | Success |
| Your prediction: {value} | Locked display |
| You didn't call this one | Locked, no pick |

---

## Result Card

**File:** `src/app/predictions/ResultCard.tsx`

### Outcome Labels
| Copy | Type |
|------|------|
| CORRECT | Badge |
| WRONG | Badge |
| PARTIAL | Badge |

### Result Display
| Copy | Type |
|------|------|
| Result pending | Fallback |
| Result recorded | Fallback |
| You: | Label |
| Result: | Label |

### Verdict Quips (correct)
| Copy |
|------|
| Well played -- banker landed. |
| Called it. Easy money. |
| Nailed it. Take a bow. |

### Verdict Quips (wrong)
| Copy |
|------|
| Ah sure look -- that one got away. |
| Swing and a miss. It happens. |
| That's one for the bin. |

### Verdict Quips (partial)
| Copy |
|------|
| Half marks -- right idea, soft execution. |
| Close enough. Take what you can get. |
| Near enough is good enough. |

---

## Join Competition Card

**File:** `src/app/predictions/join-competition-card.tsx`

| Copy | Type |
|------|------|
| Join a Competition | Title |
| Paste an invite link or code | Subtext |
| Invite link or code | Placeholder |
| Join | Button |
| Please paste an invite link or code. | Error |

---

## Competition Selector

**File:** `src/app/predictions/competition-selector.tsx`

| Copy | Type |
|------|------|
| Competition | Label |

---

## Countdown

**File:** `src/app/predictions/countdown.tsx`

| Copy | Type |
|------|------|
| Locked | Status |
| Locks in {time} | Countdown |

---

## Leaderboard Page (`/leaderboard`)

**File:** `src/app/leaderboard/page.tsx`

| Copy | Type |
|------|------|
| THE TABLE | Heading |
| No competitions yet -- join one to start calling it | Empty state |

---

## Leaderboard Table

**File:** `src/app/leaderboard/LeaderboardTable.tsx`

### Rivalry Banner
| Copy | Type |
|------|------|
| Dead heat | Headline |
| {name} and {name} are level -- tiebreaker decides it. | Body |
| Going to the wire | Headline |
| {name} leads by just {gap}% -- {name} is right on their heels. | Body |

### Sections
| Copy | Type |
|------|------|
| Best in Class | Section header |
| The Rest | Section header |
| Not yet qualified | Section header |
| Play more rounds to qualify for the table. | Guidance |

### Badges
| Copy | Type |
|------|------|
| Not qualified | Badge |
| Pending | Badge |
| Correct | Badge |
| Partial | Badge |
| Wrong | Badge |

### Expanded Detail Headers
| Copy | Type |
|------|------|
| Event | Table header |
| Sport | Table header |
| Prediction | Table header |
| Result | Table header |
| Outcome | Table header |
| Points | Table header |
| No predictions submitted | Empty state |
| Awaiting result | Placeholder |

### Tiebreaker
| Copy | Type |
|------|------|
| Tiebreaker Resolution | Section header |
| Answer: {value} | Badge |
| Tiebreaker pending | Badge |
| No answer | Placeholder |
| (off by {distance}) | Note |

---

## Profile Page (`/profile`)

**File:** `src/app/profile/ProfileForm.tsx`

| Copy | Type |
|------|------|
| Display Name | Section heading |
| Your display name | Placeholder |
| Display name must be 50 characters or fewer. | Validation |
| Avatar | Section heading |
| Google profile picture | Info |
| No avatar set | Info |
| Avatar upload is not available in this version. | Info |
| Notifications | Section heading |
| Prediction reminders | Toggle label |
| Remind me before events lock | Toggle description |
| Result notifications | Toggle label |
| Notify me when results are confirmed | Toggle description |
| Leaderboard updates | Toggle label |
| Weekly leaderboard summary | Toggle description |
| Profile saved. | Success |
| Something went wrong. Please try again. | Error |
| Network error. Please try again. | Error |
| Saving... | Loading |
| Save changes | Button |

---

## Admin Page (`/admin`)

**File:** `src/app/admin/page.tsx`

| Copy | Type |
|------|------|
| Match Day Desk | Heading |
| Manage your competitions, events, results, and participants. | Subtext |
| Back to Home | Button |
| No competitions | Empty state |
| Create your first competition to get started. | Guidance |
| Your role: {role} | Label |
| {count} pending nomination(s) | Badge |

---

## Create Competition Form

**File:** `src/app/admin/components/CreateCompetitionForm.tsx`

### Form
| Copy | Type |
|------|------|
| Create Competition | Button / heading |
| New Competition | Form heading |
| Name * | Label |
| e.g. Wexford FC Prediction League 2026 | Placeholder |
| Description | Label |
| Optional description... | Placeholder |
| Type * | Label |
| Open / Rolling | Option |
| Fixed | Option |
| All events defined at creation | Help text |
| Events added throughout the competition | Help text |
| Visibility | Label |
| Private (invite only) | Option |
| Public (open join) | Option |
| Scoring Template * | Label |

### Scoring Presets
| Copy | Type |
|------|------|
| Classic Quiz | Preset name |
| Mirrors the original paper prediction sheet. High-value margin questions reward bold picks. | Description |
| Tournament | Preset name |
| Best for golf majors, World Cups, and multi-round events. Rewards picking the eventual winner. | Description |
| Weekly Fixtures | Preset name |
| Quick rounds of match results. Low stakes per pick, high volume. Great for Premier League weekends. | Description |
| Head to Head Series | Preset name |
| Pure pick-em format. No partial credit -- you're right or you're wrong. Clean and simple. | Description |
| Custom | Preset name |
| Set your own points per prediction type. Full control over scoring and partial credit. | Description |

### Custom Scoring
| Copy | Type |
|------|------|
| Points per Prediction Type | Subheading |
| Allow partial credit | Checkbox |

### Participation Rules
| Copy | Type |
|------|------|
| Min. Rounds Required | Label |
| All (leave blank) | Placeholder |
| How many rounds participants must play. Blank = all. | Help text |
| Allow prediction updates before lock | Checkbox |

### Tiebreaker
| Copy | Type |
|------|------|
| Tiebreaker Question | Label |
| e.g. "Total goals in the World Cup" | Placeholder |
| Optional. A numeric question used to break ties. Closest to actual value wins. | Help text |

### Actions
| Copy | Type |
|------|------|
| Creating... | Loading |
| Create Competition | Button |
| Cancel | Button |

---

## Add Event Form

**File:** `src/app/admin/components/AddEventForm.tsx`

### Prediction Type Options
| Copy | Type |
|------|------|
| Winner -- Pick the outright winner | Option |
| Yes / No -- Binary outcome (Yes/No, Ireland/UK, etc.) | Option |
| Top Finishers -- Pick someone to finish in the top positions | Option |
| Final Standings -- Rank multiple competitors in predicted finishing order | Option |
| Head to Head -- Pick which of two finishes higher | Option |
| Margin of Victory -- Predict winning margin range | Option |
| Over / Under -- Predict above or below a line | Option |
| Beat the Handicap -- Predict whether a team covers the spread | Option |
| How Far Will They Go? -- Predict tournament progression stage | Option |

---

## WhatsApp / Share Copy

**File:** `src/lib/whatsapp.ts`

| Copy | Context |
|------|---------|
| {ownerName} picked {optionLabel} for {eventName} | Pick share |
| My picks for {eventName} are in -- let's see who bottles it. | Sheet locked share |
| {eventName}: called it. Easy. | Result correct |
| {eventName}: f**ked it. | Result wrong |
| {eventName}: half marks, take it. | Result partial |
| Slag alert: {name} on {points}pts, sliding {dir} | Leaderboard share |

---

## Send to Thread

**File:** `src/components/ui/SendToThread.tsx`

| Copy | Type |
|------|------|
| Send to the WhatsApp group | Heading |
| Send to the group | Submit button |
| Cancel | Button |
| Sent! | Success state |
| @ Mention | Toggle |
| Tap to send . Hold to edit | Tooltip |

---

## Push Notification Prompt

**File:** `src/components/PushNotificationPrompt.tsx`

| Copy | Type |
|------|------|
| Get pinged when locks are near | Heading |
| We'll nudge you before picks close so you never miss a round. | Description |
| Yes, ping me | Button |
| Enabling... | Loading |
| No thanks | Button |

---

## Persona Callout

**File:** `src/components/ui/PersonaCallout.tsx`

_(Labels and facts are passed as props from calling components, not hardcoded here.)_

---

## Terms of Service (`/terms`)

**File:** `src/app/terms/page.tsx`

| Copy | Type |
|------|------|
| Terms of Service | Heading |
| Last updated: 10 May 2026 | Date |
| 1. Acceptance of Terms | Section |
| By accessing or using PredictSport, you agree to be bound by these terms. If you do not agree, do not use the service. | Content |
| 2. Description of Service | Section |
| PredictSport is a social sports prediction platform where friends compete by predicting sports outcomes. It is a game of skill for entertainment purposes only. No money is wagered, won, or lost. PredictSport is not gambling. | Content |
| 3. User Accounts | Section |
| You sign in using Google. You are responsible for your account activity. | Content |
| Competitions are invite-only. You join via a link shared by the competition admin. | Content |
| You must provide accurate profile information. | Content |
| 4. User Conduct | Section |
| Do not abuse, harass, or impersonate other users. | Content |
| Do not use automated tools to submit predictions. | Content |
| Do not attempt to manipulate scores or exploit bugs. | Content |
| 5. Intellectual Property | Section |
| PredictSport and its design, code, and branding are owned by the operator. You retain ownership of the predictions you submit. | Content |
| 6. Disclaimers | Section |
| PredictSport is provided "as is" without warranties of any kind. | Content |
| We do not guarantee uninterrupted access or accuracy of sports data. | Content |
| Predictions are for entertainment among friends -- no financial value is attached. | Content |
| 7. Limitation of Liability | Section |
| To the fullest extent permitted by law, PredictSport and its operator shall not be liable for any indirect, incidental, or consequential damages arising from use of the service. | Content |
| 8. Termination | Section |
| We may suspend or terminate your account if you violate these terms. You may delete your account at any time by contacting us. | Content |
| 9. Governing Law | Section |
| These terms are governed by the laws of Ireland. Any disputes shall be subject to the exclusive jurisdiction of the Irish courts. | Content |
| 10. Changes to These Terms | Section |
| We may update these terms from time to time. Continued use after changes constitutes acceptance. | Content |
| 11. Contact | Section |
| For questions about these terms, email predictsport@gmail.com. | Content |

---

## Privacy Policy (`/privacy`)

**File:** `src/app/privacy/page.tsx`

| Copy | Type |
|------|------|
| Privacy Policy | Heading |
| Last updated: 10 May 2026 | Date |
| 1. Information We Collect | Section |
| When you sign in with Google, we receive your name, email address, and profile picture. We also store the predictions you make and your competition activity. | Content |
| 2. How We Use Your Information | Section |
| Manage your account and display your profile on leaderboards | Content |
| Calculate scores and rankings within your competitions | Content |
| Send notifications you have opted into (push, Telegram) | Content |
| 3. Information Sharing | Section |
| We do not sell or share your personal data with third parties for marketing. Your predictions and scores are visible to other members of competitions you join. | Content |
| 4. Data Storage & Security | Section |
| Your data is stored securely on Supabase (hosted in EU -- Ireland region) and served via Vercel. Access is controlled by row-level security policies. | Content |
| 5. Cookies & Sessions | Section |
| We use functional session cookies to keep you signed in. We do not use tracking or advertising cookies. | Content |
| 6. Your Rights | Section |
| Under GDPR you have the right to access, correct, or delete your personal data. To exercise these rights, contact us at the address below. | Content |
| 7. Third-Party Services | Section |
| Google OAuth -- for authentication | Content |
| Supabase -- database and auth infrastructure | Content |
| Vercel -- hosting | Content |
| Telegram -- optional notifications | Content |
| 8. Children's Privacy | Section |
| PredictSport is not directed at children under 13. We do not knowingly collect data from children. | Content |
| 9. Changes to This Policy | Section |
| We may update this policy from time to time. Changes will be posted on this page with an updated date. | Content |
| 10. Contact | Section |
| For privacy-related questions, email predictsport@gmail.com. | Content |
