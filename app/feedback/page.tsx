import Link from "next/link";
import { DisplayNameField } from "@/components/display-name-field";
import { MeetingList } from "@/components/feedback/meeting-list";
import { ProgressOverview } from "@/components/feedback/progress-overview";
import { WorkspaceTabs } from "@/components/workspace-tabs";

export default function FeedbackPage() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-12">
			<header className="flex items-center justify-between border-b border-slate-200 pb-5">
				<Link
					className="text-sm font-bold tracking-[0.2em] text-slate-800"
					href="/"
				>
					XLAIR{" "}
					<span className="font-normal text-slate-400">/ CHART REVIEW</span>
				</Link>
				<span className="text-xs text-slate-500">フィードバック会</span>
			</header>
			<WorkspaceTabs />
			<section className="py-10 sm:py-12">
				<p className="text-xs font-semibold tracking-[0.24em] text-sky-700">
					CHART FEEDBACK
				</p>
				<h1 className="mt-3 text-3xl font-semibold tracking-tight">
					フィードバックを進める
				</h1>
				<p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
					会を作成し、曲と難易度ごとに譜面を共有する。コメントと合格状況はこのサイトで一緒に確認できます。
				</p>
			</section>
			<div className="mb-8 flex flex-wrap items-end justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6">
				<div>
					<h2 className="mb-4 text-lg font-semibold">コメントの表示名</h2>
					<DisplayNameField />
				</div>
				<ProgressOverview />
			</div>
			<MeetingList />
		</main>
	);
}
