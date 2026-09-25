"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem, CatalogSheet } from "@/lib/catalog-model";

interface Meeting {
	id: string;
	heldOn: string;
	passedCount: number;
	totalCount: number;
}

interface MeetingChart {
	id: string;
	musicId: string;
	difficulty: CatalogSheet["difficulty"];
	description: string;
	uploadedAt: string;
	fileName: string;
}

interface ProgressData {
	passed: { musicId: string; difficulty: string }[];
}

async function errorMessage(response: Response) {
	const body = (await response.json().catch(() => ({}))) as { error?: string };
	return body.error ?? "処理に失敗しました。";
}

export function MeetingDetail({ meetingId }: { meetingId: string }) {
	const [meeting, setMeeting] = useState<Meeting>();
	const [charts, setCharts] = useState<MeetingChart[]>([]);
	const [catalog, setCatalog] = useState<CatalogItem[]>([]);
	const [passed, setPassed] = useState<ProgressData["passed"]>([]);
	const [selection, setSelection] = useState("");
	const [description, setDescription] = useState("");
	const [file, setFile] = useState<File>();
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const fileInput = useRef<HTMLInputElement>(null);

	const loadData = useCallback(async () => {
		setIsLoading(true);
		const responses = await Promise.all([
			fetch(`/api/meetings/${meetingId}`, { cache: "no-store" }),
			fetch(`/api/meetings/${meetingId}/charts`, { cache: "no-store" }),
			fetch("/api/catalog", { cache: "no-store" }),
			fetch("/api/progress", { cache: "no-store" }),
		]);
		const failed = responses.find((response) => !response.ok);
		if (failed) {
			setError(await errorMessage(failed));
			setIsLoading(false);
			return;
		}
		setMeeting((await responses[0].json()) as Meeting);
		setCharts((await responses[1].json()) as MeetingChart[]);
		setCatalog((await responses[2].json()) as CatalogItem[]);
		setPassed(((await responses[3].json()) as ProgressData).passed);
		setError("");
		setIsLoading(false);
	}, [meetingId]);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const availableSheets = useMemo(
		() =>
			catalog
				.flatMap((item) => item.sheets.map((sheet) => ({ item, sheet })))
				.filter(
					({ sheet }) =>
						!passed.some(
							(entry) =>
								entry.musicId === sheet.musicId &&
								entry.difficulty === sheet.difficulty,
						),
				),
		[catalog, passed],
	);
	const chosenSheet = availableSheets.find(
		({ item, sheet }) => `${item.music.id}|${sheet.difficulty}` === selection,
	);
	const existingChart =
		chosenSheet &&
		charts.find(
			(chart) =>
				chart.musicId === chosenSheet.sheet.musicId &&
				chart.difficulty === chosenSheet.sheet.difficulty,
		);

	async function uploadChart(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!chosenSheet || !file) return;
		if (
			existingChart &&
			!window.confirm(
				"譜面を差し替えると、この譜面に付いたコメントは削除されます。続けますか？",
			)
		)
			return;
		setIsSaving(true);
		const form = new FormData();
		form.set("musicId", chosenSheet.sheet.musicId);
		form.set("difficulty", chosenSheet.sheet.difficulty);
		form.set("description", description);
		form.set("file", file);
		const response = await fetch(`/api/meetings/${meetingId}/charts`, {
			method: "POST",
			body: form,
		});
		if (!response.ok) {
			setError(await errorMessage(response));
			setIsSaving(false);
			return;
		}
		setDescription("");
		setFile(undefined);
		if (fileInput.current) fileInput.current.value = "";
		await loadData();
		setIsSaving(false);
	}

	async function deleteChart(chart: MeetingChart) {
		if (
			!window.confirm("この会から譜面を削除しますか？コメントも削除されます。")
		)
			return;
		const response = await fetch(
			`/api/meetings/${meetingId}/charts/${chart.id}`,
			{ method: "DELETE" },
		);
		if (!response.ok) {
			setError(await errorMessage(response));
			return;
		}
		await loadData();
	}

	if (isLoading)
		return (
			<p className="py-12 text-center text-sm text-slate-500">読み込み中…</p>
		);
	if (!meeting)
		return (
			<p className="py-12 text-sm text-rose-700">
				{error || "FB 会が見つかりません。"}
			</p>
		);

	return (
		<>
			<section className="py-10">
				<p className="text-xs font-semibold tracking-[0.2em] text-sky-700">
					FEEDBACK SESSION
				</p>
				<h1 className="mt-3 text-3xl font-semibold">{meeting.heldOn} の会</h1>
				<div className="mt-5 max-w-xl">
					<div className="flex items-center justify-between text-sm text-slate-600">
						<span>この会の終了時点の進捗</span>
						<span>
							{meeting.passedCount} / {meeting.totalCount} 譜面
						</span>
					</div>
					<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
						<div
							className="h-full rounded-full bg-emerald-500"
							style={{
								width: `${meeting.totalCount ? Math.min(100, (meeting.passedCount / meeting.totalCount) * 100) : 0}%`,
							}}
						/>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200 bg-white p-6">
				<h2 className="text-xl font-semibold">譜面を追加する</h2>
				<p className="mt-2 text-sm leading-6 text-slate-600">
					合格済みの譜面は選択肢に表示されません。対応形式は C2S、SUS、UGC
					です。
				</p>
				<form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={uploadChart}>
					<label className="text-sm font-medium text-slate-700">
						曲・難易度
						<select
							className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
							onChange={(event) => setSelection(event.target.value)}
							required
							value={selection}
						>
							<option value="">選択してください</option>
							{availableSheets.map(({ item, sheet }) => (
								<option
									key={`${item.music.id}-${sheet.difficulty}`}
									value={`${item.music.id}|${sheet.difficulty}`}
								>
									{item.music.title} — {sheet.difficulty} {sheet.level}
								</option>
							))}
						</select>
					</label>
					<label className="text-sm font-medium text-slate-700">
						譜面ファイル
						<input
							accept=".c2s,.sus,.ugc"
							className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
							onChange={(event) => setFile(event.target.files?.[0])}
							required
							ref={fileInput}
							type="file"
						/>
					</label>
					<label className="text-sm font-medium text-slate-700 md:col-span-2">
						説明
						<textarea
							className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
							onChange={(event) => setDescription(event.target.value)}
							rows={3}
							value={description}
						/>
					</label>
					<div className="md:col-span-2">
						<button
							className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
							disabled={isSaving || !availableSheets.length}
							type="submit"
						>
							{isSaving ? "保存中…" : "譜面を保存"}
						</button>
					</div>
				</form>
				{error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
			</section>

			<section className="mt-10">
				<div className="mb-4 flex items-baseline justify-between gap-4">
					<h2 className="text-xl font-semibold">この会の譜面</h2>
					<span className="text-sm text-slate-500">{charts.length} 譜面</span>
				</div>
				{charts.length === 0 ? (
					<p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
						譜面はまだありません。
					</p>
				) : (
					<ul className="space-y-3">
						{charts.map((chart) => {
							const item = catalog.find(
								(entry) => entry.music.id === chart.musicId,
							);
							const sheet = item?.sheets.find(
								(entry) => entry.difficulty === chart.difficulty,
							);
							return (
								<li
									className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"
									key={chart.id}
								>
									<div>
										<p className="font-semibold">
											{item?.music.title ?? chart.musicId} — {chart.difficulty}{" "}
											{sheet?.level ?? ""}
										</p>
										{chart.description && (
											<p className="mt-1 text-sm leading-6 text-slate-600">
												{chart.description}
											</p>
										)}
										<p className="mt-2 text-xs text-slate-400">
											更新 {new Date(chart.uploadedAt).toLocaleString()}
										</p>
									</div>
									<div className="flex items-center gap-4">
										<Link
											className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
											href={`/feedback/${meetingId}/charts/${chart.id}`}
										>
											開く
										</Link>
										{!passed.some(
											(entry) =>
												entry.musicId === chart.musicId &&
												entry.difficulty === chart.difficulty,
										) && (
											<button
												className="text-sm text-slate-500 hover:text-rose-700"
												onClick={() => void deleteChart(chart)}
												type="button"
											>
												削除
											</button>
										)}
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</>
	);
}
