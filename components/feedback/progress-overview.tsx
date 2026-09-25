"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogItem } from "@/lib/catalog-model";

interface ProgressData {
	passed: {
		musicId: string;
		difficulty: string;
		passedAt: string;
		meetingId: string | null;
		chartId: string | null;
	}[];
	passedCount: number;
	totalCount: number;
}

export function ProgressOverview() {
	const [progress, setProgress] = useState<ProgressData>();
	const [catalog, setCatalog] = useState<CatalogItem[]>([]);
	const [error, setError] = useState("");

	useEffect(() => {
		Promise.all([
			fetch("/api/progress", { cache: "no-store" }),
			fetch("/api/catalog", { cache: "no-store" }),
		]).then(async ([progressResponse, catalogResponse]) => {
			if (!progressResponse.ok || !catalogResponse.ok) {
				const response = !catalogResponse.ok
					? catalogResponse
					: progressResponse;
				const body = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				setError(body.error ?? "進捗を読み込めませんでした。");
				return;
			}
			setProgress((await progressResponse.json()) as ProgressData);
			setCatalog((await catalogResponse.json()) as CatalogItem[]);
		});
	}, []);

	async function undoPass(musicId: string, difficulty: string) {
		if (!window.confirm("この譜面の合格を取り消しますか？")) return;
		const response = await fetch(`/api/progress/${musicId}/${difficulty}`, {
			method: "DELETE",
		});
		if (response.ok) {
			setProgress(
				(current) =>
					current && {
						...current,
						passed: current.passed.filter(
							(sheet) =>
								sheet.musicId !== musicId || sheet.difficulty !== difficulty,
						),
						passedCount: Math.max(0, current.passedCount - 1),
					},
			);
		}
	}

	const totalCount = progress?.totalCount ?? 0;
	const percent = totalCount
		? Math.round(((progress?.passedCount ?? 0) / totalCount) * 100)
		: 0;
	return (
		<section className="w-full max-w-md">
			<div className="flex items-baseline justify-between gap-4">
				<h2 className="text-lg font-semibold">全体の進捗</h2>
				<span className="text-sm tabular-nums text-slate-500">
					{progress
						? `${progress.passedCount} / ${totalCount} 譜面`
						: "読み込み中…"}
				</span>
			</div>
			<div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
				<div
					className="h-full rounded-full bg-emerald-500 transition-all"
					style={{ width: `${percent}%` }}
				/>
			</div>
			{error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
			{progress?.passed.length ? (
				<details className="mt-4">
					<summary className="cursor-pointer text-sm font-medium text-slate-700">
						合格した譜面を見る
					</summary>
					<ul className="mt-3 space-y-2 text-sm">
						{progress.passed.map((passed) => {
							const item = catalog.find(
								(entry) => entry.music.id === passed.musicId,
							);
							const sheet = item?.sheets.find(
								(entry) => entry.difficulty === passed.difficulty,
							);
							return (
								<li
									className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
									key={`${passed.musicId}-${passed.difficulty}`}
								>
									{passed.meetingId && passed.chartId ? (
										<Link
											className="text-sky-800 hover:underline"
											href={`/feedback/${passed.meetingId}/charts/${passed.chartId}`}
										>
											{item?.music.title ?? passed.musicId} ・{" "}
											{passed.difficulty} {sheet?.level ?? ""}
										</Link>
									) : (
										<span>
											{item?.music.title ?? passed.musicId} ・{" "}
											{passed.difficulty} {sheet?.level ?? ""}
										</span>
									)}
									<button
										className="text-xs text-slate-500 hover:text-rose-700"
										onClick={() =>
											void undoPass(passed.musicId, passed.difficulty)
										}
										type="button"
									>
										合格を取り消す
									</button>
								</li>
							);
						})}
					</ul>
				</details>
			) : null}
		</section>
	);
}
