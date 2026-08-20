import { redirect } from "next/navigation";

/** 旧「助学金记录」入口并入助学金审核页，保留书签兼容。 */
export default async function GrantReviewRecordsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const next = tab === "todo" || tab === "done" || tab === "all" ? tab : "all";
  redirect(`/grant-reviews?tab=${next}`);
}
