# PREDICT

Social sports prediction quiz for friend groups. Submit predictions for real sporting events throughout the year, earn points for correct answers, compete on a leaderboard.

No betting. No wagering. Just bragging rights.

## How It Works

1. Admin creates a competition with ~35 prediction questions at the start of the year
2. Each question: "Who will win the US Masters?", "Will Ireland qualify for the World Cup?", etc.
3. Users submit predictions before each event's lock deadline
4. Admin enters results as they happen throughout the year
5. Points awarded automatically (10pts correct, 20pts for dual questions with partial credit)
6. Leaderboard updates in real time
7. Tiebreaker question (predict a number) breaks any ties

## Stack

- **App:** Next.js (TypeScript, Tailwind) on Vercel
- **Database:** PostgreSQL on Supabase
- **Auth:** Google OAuth via Supabase
- **Notifications:** WhatsApp Cloud API (free tier)

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Requires `.env.local` with Supabase credentials. See `docs/` for full specification.
