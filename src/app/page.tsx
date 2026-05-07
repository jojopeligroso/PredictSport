import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-ps-bg">
      <main className="flex flex-col items-center gap-8 p-8 text-center">
        <h1 className="font-display text-6xl tracking-wide text-ps-text">
          PREDICT
        </h1>
        <p className="max-w-md text-lg text-ps-text-sec">
          Sports prediction quiz for your group. Pick winners, earn points,
          climb the leaderboard.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/predictions"
            className="rounded-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-6 py-3 text-center text-sm font-extrabold text-[#1a1208] transition-opacity hover:opacity-90"
          >
            My Predictions
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-full border border-ps-border px-6 py-3 text-center text-sm font-medium text-ps-text transition-colors hover:bg-ps-surface"
          >
            Leaderboard
          </Link>
        </div>
      </main>
    </div>
  );
}
