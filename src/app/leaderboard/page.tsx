export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Leaderboard
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        See how everyone is doing across the competition.
      </p>
      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-12 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        No results yet. Check back once events start resolving.
      </div>
    </div>
  );
}
