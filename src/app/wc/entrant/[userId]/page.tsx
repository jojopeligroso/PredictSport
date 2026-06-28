import { notFound } from "next/navigation";
import { fetchEntrantProfileData } from "./fetchEntrantProfileData";
import { EntrantProfileClient } from "./EntrantProfileClient";

interface PageProps {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function EntrantProfilePage({ params, searchParams }: PageProps) {
  const { userId } = await params;
  const { from } = await searchParams;
  const data = await fetchEntrantProfileData(userId);

  if (!data.found) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-24 pt-4">
      <EntrantProfileClient data={data} from={from} />
    </div>
  );
}
