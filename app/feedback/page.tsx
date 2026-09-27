import Link from "next/link";
import { FeedbackBreadcrumbs } from "@/components/feedback/feedback-breadcrumbs";
import { MeetingList } from "@/components/feedback/meeting-list";

export default function FeedbackPage() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-6 sm:px-8">
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
			<FeedbackBreadcrumbs
				items={[{ href: "/", label: "トップ" }, { label: "フィードバック会" }]}
			/>
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
			<MeetingList />
		</main>
	);
}
