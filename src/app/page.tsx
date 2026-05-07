import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center py-16">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Logo mark */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#d97706] shadow-lg">
          <span className="text-2xl font-bold leading-none text-[#1a1208]">
            PS
          </span>
        </div>

        <div>
          <h1 className="text-2xl uppercase tracking-[0.06em]">
            <span className="font-light text-ps-text">Predict</span>
            <span className="font-bold text-ps-amber-deep">Sport</span>
          </h1>
          <p className="mt-2 text-sm text-ps-text-ter">
            The Sheet
          </p>
        </div>

        <p className="max-w-xs text-[0.82rem] leading-relaxed text-ps-text-sec">
          Sports prediction quiz for your group. Pick winners, earn points,
          climb the leaderboard.
        </p>

        <div className="flex w-full flex-col gap-3">
          <Link
            href="/predictions"
            className="block w-full rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-6 py-3.5 text-center text-sm font-extrabold text-[#1a1208] transition-opacity hover:opacity-90"
          >
            My Predictions
          </Link>
          <Link
            href="/leaderboard"
            className="block w-full rounded-xl border border-ps-border-strong px-6 py-3.5 text-center text-sm font-semibold text-ps-text transition-colors hover:bg-ps-surface"
          >
            Leaderboard
          </Link>
        </div>

        <p className="mt-2 text-xs text-ps-text-ter">
          No betting. No wagering. Just bragging rights.
        </p>
      </div>
    </div>
  );
}
