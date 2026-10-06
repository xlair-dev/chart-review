import Link from "next/link";
import { DisplayNameControl } from "@/components/display-name-control";

const workspaces = [
	{
		number: "01",
		title: "譜面ビューワー",
		description: "音源と譜面を読み込み、再生しながら確認する。",
		status: "ローカル解析",
		href: "/viewer",
	},
	{
		number: "02",
		title: "フィードバック会",
		description: "譜面を共有し、コメントと進捗を管理する。",
		status: "利用可能",
		href: "/feedback",
	},
];

export default function Home() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-6 sm:px-8">
			<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-slate-200 pb-5">
				<a
					className="text-sm font-bold tracking-[0.2em] text-slate-800"
					href="/"
				>
					XLAIR{" "}
					<span className="font-normal text-slate-400">/ CHART REVIEW</span>
				</a>
				<div className="flex items-center gap-2">
					<span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 sm:inline">
						譜面制作サポート
					</span>
					<DisplayNameControl />
				</div>
			</header>
			<section
				aria-label="ワークスペース"
				className="mt-8 grid gap-4 sm:grid-cols-2"
			>
				{workspaces.map((workspace) => (
					<Link
						className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-sky-300 hover:bg-sky-50/30 hover:shadow-sm sm:p-8"
						href={workspace.href}
						key={workspace.number}
					>
						<div className="flex items-start justify-between">
							<span className="text-xs font-semibold tracking-[0.16em] text-sky-700">
								{workspace.number}
							</span>
							<span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
								{workspace.status}
							</span>
						</div>
						<h2 className="mt-9 text-2xl font-semibold">{workspace.title}</h2>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							{workspace.description}
						</p>
						<span className="mt-7 inline-flex text-sm font-medium text-sky-800 group-hover:text-sky-600">
							開く{" "}
							<span aria-hidden="true" className="ml-2">
								→
							</span>
						</span>
					</Link>
				))}
			</section>

			<footer className="mt-auto pt-16 text-xs text-slate-400">
				XLAIR Chart Review
			</footer>
		</main>
	);
}
