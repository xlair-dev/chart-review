import Link from "next/link";
import { ChartFileLoader } from "@/components/viewer/chart-file-loader";
import { WorkspaceTabs } from "@/components/workspace-tabs";

export default function ViewerPage() {
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
				<span className="text-xs text-slate-500">譜面ビューワー</span>
			</header>
			<WorkspaceTabs />

			<section className="py-12 sm:py-16">
				<p className="text-xs font-semibold tracking-[0.24em] text-sky-700">
					CHART VIEWER
				</p>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
					譜面を読み込む
				</h1>
				<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
					ローカルの譜面を読み込み、内容を確認する。読み込んだファイルはサーバーへ送信しません。
				</p>
			</section>

			<ChartFileLoader />
		</main>
	);
}
