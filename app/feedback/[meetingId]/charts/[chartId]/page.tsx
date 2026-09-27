import Link from "next/link";
import { FeedbackBreadcrumbs } from "@/components/feedback/feedback-breadcrumbs";
import { FeedbackChartReview } from "@/components/feedback/feedback-chart-review";

export default async function FeedbackChartPage({
	params,
}: {
	params: Promise<{ meetingId: string; chartId: string }>;
}) {
	const { meetingId, chartId } = await params;
	return (
		<main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-6 sm:px-8">
			<header className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
				<Link
					className="text-sm font-bold tracking-[0.2em] text-slate-800"
					href="/"
				>
					XLAIR{" "}
					<span className="font-normal text-slate-400">/ CHART REVIEW</span>
				</Link>
				<Link
					className="text-sm text-sky-800 hover:underline"
					href={`/feedback/${meetingId}`}
				>
					会に戻る
				</Link>
			</header>
			<FeedbackBreadcrumbs
				items={[
					{ href: "/", label: "トップ" },
					{ href: "/feedback", label: "フィードバック会" },
					{ href: `/feedback/${meetingId}`, label: "会の譜面" },
					{ label: "譜面レビュー" },
				]}
			/>
			<FeedbackChartReview chartId={chartId} meetingId={meetingId} />
		</main>
	);
}
