"use client";

import { useEffect, useState } from "react";
import { DisplayNameField } from "@/components/display-name-field";
import { ChartPlayback } from "@/components/viewer/chart-playback";
import type { CatalogItem } from "@/lib/catalog-model";
import type { ChartData } from "@/lib/chart-model";
import { parseChartFile } from "@/lib/chart-parser";
import { positionFromValue, positionValue } from "@/lib/chart-position";
import { useDisplayName } from "@/lib/use-display-name";

interface MeetingChart {
	id: string;
	musicId: string;
	difficulty: string;
	description: string;
	fileName: string;
}

interface Comment {
	id: string;
	displayName: string;
	numerator: string;
	denominator: string;
	body: string;
	createdAt: string;
}

export function FeedbackChartReview({
	meetingId,
	chartId,
}: {
	meetingId: string;
	chartId: string;
}) {
	const [chart, setChart] = useState<ChartData>();
	const [chartRecord, setChartRecord] = useState<MeetingChart>();
	const [music, setMusic] = useState<CatalogItem["music"]>();
	const [comments, setComments] = useState<Comment[]>([]);
	const [position, setPosition] = useState(0);
	const [commentBody, setCommentBody] = useState("");
	const [isPassed, setIsPassed] = useState(false);
	const [error, setError] = useState("");
	const { displayName } = useDisplayName();

	useEffect(() => {
		let active = true;
		async function load() {
			try {
				const [
					chartsResponse,
					fileResponse,
					catalogResponse,
					commentsResponse,
					progressResponse,
				] = await Promise.all([
					fetch(`/api/meetings/${meetingId}/charts`, { cache: "no-store" }),
					fetch(`/api/meetings/${meetingId}/charts/${chartId}/file`, {
						cache: "no-store",
					}),
					fetch("/api/catalog", { cache: "no-store" }),
					fetch(`/api/meetings/${meetingId}/charts/${chartId}/comments`, {
						cache: "no-store",
					}),
					fetch("/api/progress", { cache: "no-store" }),
				]);
				const failure = [
					chartsResponse,
					fileResponse,
					catalogResponse,
					commentsResponse,
					progressResponse,
				].find((response) => !response.ok);
				if (failure) {
					const message = (await failure.json().catch(() => ({}))) as {
						error?: string;
					};
					throw new Error(message.error ?? "譜面を読み込めませんでした。");
				}
				const records = (await chartsResponse.json()) as MeetingChart[];
				const record = records.find((entry) => entry.id === chartId);
				if (!record) throw new Error("譜面が見つかりません。");
				const catalog = (await catalogResponse.json()) as CatalogItem[];
				const musicItem = catalog.find(
					(entry) => entry.music.id === record.musicId,
				);
				if (!musicItem) throw new Error("曲がカタログにありません。");
				const fileBlob = await fileResponse.blob();
				const parsedChart = await parseChartFile(
					new File([fileBlob], record.fileName),
				);
				const progress = (await progressResponse.json()) as {
					passed: { musicId: string; difficulty: string }[];
				};
				if (!active) return;
				setChartRecord(record);
				setMusic(musicItem.music);
				setChart(parsedChart);
				setComments((await commentsResponse.json()) as Comment[]);
				setIsPassed(
					progress.passed.some(
						(entry) =>
							entry.musicId === record.musicId &&
							entry.difficulty === record.difficulty,
					),
				);
			} catch (loadError) {
				if (active)
					setError(
						loadError instanceof Error
							? loadError.message
							: "譜面を読み込めませんでした。",
					);
			}
		}
		void load();
		return () => {
			active = false;
		};
	}, [meetingId, chartId]);

	async function addComment(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const response = await fetch(
			`/api/meetings/${meetingId}/charts/${chartId}/comments`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					displayName,
					position: positionFromValue(position),
					body: commentBody,
				}),
			},
		);
		if (!response.ok) {
			const result = (await response.json().catch(() => ({}))) as {
				error?: string;
			};
			setError(result.error ?? "コメントを保存できませんでした。");
			return;
		}
		const comment = (await response.json()) as Comment;
		setComments((current) => [...current, comment]);
		setCommentBody("");
		setError("");
	}

	async function togglePassed() {
		const next = !isPassed;
		if (next && !window.confirm("この譜面を合格として記録しますか？")) return;
		if (!chartRecord) return;
		const response = await fetch(
			`/api/progress/${chartRecord.musicId}/${chartRecord.difficulty}`,
			{ method: next ? "PUT" : "DELETE" },
		);
		if (!response.ok) {
			setError("合格状況を更新できませんでした。");
			return;
		}
		setIsPassed(next);
	}

	if (!chart || !chartRecord || !music) {
		return (
			<p
				className={
					error
						? "py-12 text-center text-sm text-rose-700"
						: "py-12 text-center text-sm text-slate-500"
				}
			>
				{error || "譜面を読み込み中…"}
			</p>
		);
	}

	return (
		<div>
			<div className="mb-6 flex flex-wrap items-start justify-between gap-5">
				<div>
					<p className="text-sm text-slate-500">{music.artist}</p>
					<h1 className="mt-1 text-2xl font-semibold">
						{music.title} — {chartRecord.difficulty}
					</h1>
					{chartRecord.description && (
						<p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
							{chartRecord.description}
						</p>
					)}
				</div>
				<button
					className={
						isPassed
							? "rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-800"
							: "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
					}
					onClick={() => void togglePassed()}
					type="button"
				>
					{isPassed ? "合格を取り消す" : "合格にする"}
				</button>
			</div>
			{error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
			<div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_21rem]">
				<ChartPlayback
					chart={chart}
					audioSource={music.audio?.url}
					onPositionChange={setPosition}
					position={position}
				/>
				<aside className="rounded-2xl border border-slate-200 bg-white p-5">
					<h2 className="text-lg font-semibold">コメント</h2>
					<div className="mt-4 max-h-[45vh] space-y-3 overflow-y-auto">
						{comments.length === 0 ? (
							<p className="text-sm text-slate-500">
								コメントはまだありません。
							</p>
						) : (
							comments.map((comment) => (
								<button
									className="block w-full rounded-xl bg-slate-50 p-3 text-left hover:bg-sky-50"
									key={comment.id}
									onClick={() =>
										setPosition(
											positionValue({
												numerator: comment.numerator,
												denominator: comment.denominator,
											}),
										)
									}
									type="button"
								>
									<span className="flex items-baseline justify-between gap-2 text-xs text-slate-500">
										<strong className="font-medium text-slate-800">
											{comment.displayName}
										</strong>
										<span>
											{positionValue({
												numerator: comment.numerator,
												denominator: comment.denominator,
											}).toFixed(2)}{" "}
											拍
										</span>
									</span>
									<span className="mt-2 block whitespace-pre-wrap text-sm leading-6">
										{comment.body}
									</span>
								</button>
							))
						)}
					</div>
					<form
						className="mt-5 border-t border-slate-100 pt-5"
						onSubmit={addComment}
					>
						<DisplayNameField />
						<p className="mt-4 text-xs text-slate-500">
							コメント位置: {position.toFixed(2)} 拍
						</p>
						<textarea
							className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
							maxLength={2000}
							onChange={(event) => setCommentBody(event.target.value)}
							placeholder="気づいた点を書く"
							required
							rows={4}
							value={commentBody}
						/>
						<button
							className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
							disabled={!displayName || !commentBody.trim()}
							type="submit"
						>
							コメントを追加
						</button>
					</form>
				</aside>
			</div>
		</div>
	);
}
