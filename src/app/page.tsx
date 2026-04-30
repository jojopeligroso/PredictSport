import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-8 p-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          PREDICT
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Sports prediction quiz for your group. Pick winners, earn points,
          climb the leaderboard.
        </p>
        <div className="flex gap-4">
          <Link
            href="/predictions"
            className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            My Predictions
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Leaderboard
          </Link>
        </div>
      </main>
    </div>
  );
}
