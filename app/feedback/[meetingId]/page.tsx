import Link from "next/link";
import { MeetingDetail } from "@/components/feedback/meeting-detail";
import { WorkspaceTabs } from "@/components/workspace-tabs";

export default async function MeetingPage({
	params,
}: {
	params: Promise<{ meetingId: string }>;
}) {
	const { meetingId } = await params;
	return (
		<main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-8 sm:px-10 sm:py-12">
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
			<WorkspaceTabs />
			<MeetingDetail meetingId={meetingId} />
		</main>
	);
}
