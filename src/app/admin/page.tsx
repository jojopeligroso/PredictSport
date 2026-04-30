export default function AdminPage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Admin Panel
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Manage competitions, events, results, and participants.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Competitions
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create and configure competitions with scoring rules.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Events &amp; Results
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Add events, confirm results, review nominations.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Participants
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage members, invite links, and co-admins.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Nominations
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Review and approve event nominations from participants.
          </p>
        </div>
      </div>
    </div>
  );
}
