import Link from "next/link";
import { DisplayNameControl } from "@/components/display-name-control";
import { FeedbackBreadcrumbs } from "@/components/feedback/feedback-breadcrumbs";
import { MeetingDetail } from "@/components/feedback/meeting-detail";

export default async function MeetingPage({
	params,
}: {
	params: Promise<{ meetingId: string }>;
}) {
	const { meetingId } = await params;
	return (
		<main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-6 sm:px-8">
			<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-slate-200 pb-5">
				<Link
					className="text-sm font-bold tracking-[0.2em] text-slate-800"
					href="/"
				>
					XLAIR{" "}
					<span className="font-normal text-slate-400">/ CHART REVIEW</span>
				</Link>
				<div className="flex items-center gap-3">
					<DisplayNameControl />
				</div>
			</header>
			<FeedbackBreadcrumbs
				items={[
					{ href: "/", label: "トップ" },
					{ href: "/feedback", label: "フィードバック会" },
					{ label: "会の譜面" },
				]}
			/>
			<MeetingDetail meetingId={meetingId} />
		</main>
	);
}
