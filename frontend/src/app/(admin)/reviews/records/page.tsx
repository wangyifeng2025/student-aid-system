import { redirect } from "next/navigation";

/** 旧「认定记录」入口并入困难认定审核页，保留书签兼容。 */
export default async function ReviewRecordsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const next = tab === "todo" || tab === "done" || tab === "all" ? tab : "all";
  redirect(`/reviews?tab=${next}`);
}
