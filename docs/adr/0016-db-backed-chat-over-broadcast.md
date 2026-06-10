# DB-backed chat via postgres_changes over ephemeral broadcast

Competition Chat uses Supabase Realtime `postgres_changes` subscriptions against a `chat_messages` table, rather than Supabase `broadcast` channels.

Broadcast would be simpler (no schema, no RLS, no storage costs) and lower latency, but it's ephemeral — messages only reach clients connected at send time. The core usage pattern for PredictSport is asynchronous: users check in around their day, not in synchronised sessions. A user opening the app hours after a flurry of chat activity must see those messages. That requires persistence, which means the messages live in Postgres.

The trade-off is more infrastructure (table, RLS policies, pagination API, Realtime publication config) for a chat experience that actually works when people aren't online simultaneously — which is most of the time.

## Considered options

- **Supabase `broadcast`** — zero storage, lowest latency, simplest setup. Rejected because messages are fire-and-forget; offline users see nothing.
- **Hybrid (broadcast + manual DB writes)** — broadcast for live delivery, separate INSERT for persistence. Rejected as unnecessary complexity; `postgres_changes` gives both persistence and live delivery in one path.
- **Supabase `postgres_changes`** — chosen. INSERT triggers both DB persistence and Realtime subscription delivery. Single write path. RLS secures reads to competition members. Pagination via standard API queries.
