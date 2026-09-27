import Link from "next/link";
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
			<header className="flex items-center justify-between border-b border-slate-200 pb-5">
				<Link
					className="text-sm font-bold tracking-[0.2em] text-slate-800"
					href="/"
				>
					XLAIR{" "}
					<span className="font-normal text-slate-400">/ CHART REVIEW</span>
				</Link>
				<Link className="text-sm text-sky-800 hover:underline" href="/feedback">
					すべての会
				</Link>
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
