"use client";

export interface ChartVotes {
	passed: string[];
	failed: string[];
}

export function ChartVoteSummary({ votes }: { votes: ChartVotes }) {
	const totalVotes = votes.passed.length + votes.failed.length;
	const rate = totalVotes
		? Math.round((votes.passed.length / totalVotes) * 100)
		: 0;
	const voterGroup = (label: string, names: string[]) => (
		<span className="group relative inline-flex cursor-help rounded-sm">
			{label} {names.length}票
			<span
				aria-hidden="true"
				className="absolute bottom-full left-0 z-30 mb-2 max-h-48 w-max max-w-[min(18rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus:opacity-100"
			>
				{names.length ? (
					names.map((name) => (
						<span className="block [overflow-wrap:anywhere]" key={name}>
							{name}
						</span>
					))
				) : (
					<span>投票者なし</span>
				)}
			</span>
		</span>
	);
	return (
		<div className="flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
			{voterGroup("合格", votes.passed)}
			{voterGroup("不合格", votes.failed)}
			<span>合格投票率 {rate}%</span>
		</div>
	);
}

export function ChartVotePanel({
	displayName,
	votes,
	isSaving,
	onVote,
}: {
	displayName: string;
	votes: ChartVotes;
	isSaving: boolean;
	onVote: (vote: "passed" | "failed" | null) => void;
}) {
	const key = displayName.trim().normalize("NFKC").toLocaleLowerCase("ja-JP");
	const currentVote = key
		? votes.passed.some(
				(name) => name.normalize("NFKC").toLocaleLowerCase("ja-JP") === key,
			)
			? "passed"
			: votes.failed.some(
						(name) => name.normalize("NFKC").toLocaleLowerCase("ja-JP") === key,
					)
				? "failed"
				: null
		: null;
	return (
		<section aria-label="投票" className="mt-5 rounded-xl bg-slate-50 p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-sm font-semibold text-slate-800">投票</p>
					<ChartVoteSummary votes={votes} />
				</div>
				<div className="flex flex-wrap gap-2">
					<button
						className={
							currentVote === "passed"
								? "rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white"
								: "rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-800"
						}
						disabled={!displayName.trim() || isSaving}
						onClick={() => onVote(currentVote === "passed" ? null : "passed")}
						type="button"
					>
						合格
					</button>
					<button
						className={
							currentVote === "failed"
								? "rounded-lg bg-rose-700 px-3 py-2 text-sm text-white"
								: "rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-800"
						}
						disabled={!displayName.trim() || isSaving}
						onClick={() => onVote(currentVote === "failed" ? null : "failed")}
						type="button"
					>
						不合格
					</button>
				</div>
			</div>
			{!displayName.trim() && (
				<p className="mt-2 text-xs text-slate-500">
					投票するには表示名を設定してください。
				</p>
			)}
		</section>
	);
}
