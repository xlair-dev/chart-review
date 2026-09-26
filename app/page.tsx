const workspaces = [
	{
		number: "01",
		title: "譜面ビューワー",
		description: "譜面を読み込み、再生しながら確認する。",
		status: "準備中",
	},
	{
		number: "02",
		title: "フィードバック会",
		description: "譜面を共有し、コメントと進捗を管理する。",
		status: "準備中",
	},
];

export default function Home() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-10 sm:py-12">
			<header className="flex items-center justify-between border-b border-slate-200 pb-5">
				<a
					className="text-sm font-bold tracking-[0.2em] text-slate-800"
					href="/"
				>
					XLAIR{" "}
					<span className="font-normal text-slate-400">/ CHART REVIEW</span>
				</a>
				<span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
					譜面制作サポート
				</span>
			</header>

			<section className="py-16 sm:py-24">
				<p className="mb-4 text-xs font-semibold tracking-[0.24em] text-sky-700">
					CHART REVIEW WORKSPACE
				</p>
				<h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
					譜面を見て、
					<br />
					一緒に磨く。
				</h1>
				<p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
					譜面の再生とフィードバックを通じて、制作チームのレビューを支援します。
				</p>
			</section>

			<section
				aria-label="ワークスペース"
				className="grid gap-4 sm:grid-cols-2"
			>
				{workspaces.map((workspace) => (
					<article
						className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
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
					</article>
				))}
			</section>

			<footer className="mt-auto pt-16 text-xs text-slate-400">
				XLAIR Chart Review
			</footer>
		</main>
	);
}
