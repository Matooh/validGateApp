import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';

export default async function GuardianRelationshipsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; kind?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.message) query.set('message', params.message);
  if (params.kind) query.set('kind', params.kind);
  redirect(`/links${query.toString() ? `?${query.toString()}` : ''}`);
}
