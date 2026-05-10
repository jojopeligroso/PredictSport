import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCompetitionDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/competitions/${id}`);
}
