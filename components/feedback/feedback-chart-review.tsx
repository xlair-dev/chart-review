"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import {
	ChartVotePanel,
	type ChartVotes,
} from "@/components/feedback/chart-vote-panel";
import { ChartPlayback } from "@/components/viewer/chart-playback";
import type { ChartComment } from "@/components/viewer/chart-renderer";
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
	uploadedBy: string;
	votes: ChartVotes;
}

interface Comment {
	id: string;
	displayName: string;
	numerator: string;
	denominator: string;
	lanePosition: number;
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
	const [commentPosition, setCommentPosition] = useState(0);
	const [commentLanePosition, setCommentLanePosition] = useState<number | null>(
		null,
	);
	const [commentBody, setCommentBody] = useState("");
	const [isPassed, setIsPassed] = useState(false);
	const [isPassConfirmationOpen, setIsPassConfirmationOpen] = useState(false);
	const [isUpdatingPass, setIsUpdatingPass] = useState(false);
	const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
		useState(false);
	const [isDeletingChart, setIsDeletingChart] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [descriptionDraft, setDescriptionDraft] = useState("");
	const [isSavingDescription, setIsSavingDescription] = useState(false);
	const [isSavingComment, setIsSavingComment] = useState(false);
	const [isSavingVote, setIsSavingVote] = useState(false);
	const [pendingCommentDeletion, setPendingCommentDeletion] =
		useState<Comment>();
	const [isDeletingComment, setIsDeletingComment] = useState(false);
	const [error, setError] = useState("");
	const router = useRouter();
	const { displayName } = useDisplayName();
	const chartComments: ChartComment[] = comments.map((comment) => ({
		...comment,
		position: positionValue({
			numerator: comment.numerator,
			denominator: comment.denominator,
		}),
	}));

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

	async function addComment() {
		if (commentLanePosition === null || !commentBody.trim()) return;
		setIsSavingComment(true);
		try {
			const response = await fetch(
				`/api/meetings/${meetingId}/charts/${chartId}/comments`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						displayName,
						position: positionFromValue(commentPosition),
						body: commentBody,
						lanePosition: commentLanePosition,
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
			setCommentLanePosition(null);
			setError("");
		} catch {
			setError("コメントを保存できませんでした。通信状態を確認してください。");
		} finally {
			setIsSavingComment(false);
		}
	}

	async function togglePassed() {
		const next = !isPassed;
		if (!chartRecord) return;
		setIsUpdatingPass(true);
		try {
			const response = await fetch(
				`/api/progress/${chartRecord.musicId}/${chartRecord.difficulty}`,
				{ method: next ? "PUT" : "DELETE" },
			);
			if (!response.ok) {
				setError("合格状況を更新できませんでした。");
				return;
			}
			setIsPassed(next);
			setIsPassConfirmationOpen(false);
		} catch {
			setError("合格状況を更新できませんでした。通信状態を確認してください。");
		} finally {
			setIsUpdatingPass(false);
		}
	}

	async function castVote(vote: "passed" | "failed" | null) {
		if (!displayName.trim()) return;
		setIsSavingVote(true);
		try {
			const response = await fetch(
				`/api/meetings/${meetingId}/charts/${chartId}/votes`,
				{
					method: vote ? "PUT" : "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ displayName, ...(vote && { vote }) }),
				},
			);
			if (!response.ok) {
				const result = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				setError(result.error ?? "投票を保存できませんでした。");
				return;
			}
			setChartRecord((current) => {
				if (!current) return current;
				const key = displayName
					.trim()
					.normalize("NFKC")
					.toLocaleLowerCase("ja-JP");
				const next: ChartVotes = {
					passed: current.votes.passed.filter(
						(name) => name.normalize("NFKC").toLocaleLowerCase("ja-JP") !== key,
					),
					failed: current.votes.failed.filter(
						(name) => name.normalize("NFKC").toLocaleLowerCase("ja-JP") !== key,
					),
				};
				if (vote) next[vote].push(displayName.trim());
				return { ...current, votes: next };
			});
			setError("");
		} catch {
			setError("投票を保存できませんでした。通信状態を確認してください。");
		} finally {
			setIsSavingVote(false);
		}
	}

	async function saveDescription() {
		if (!chartRecord) return;
		setIsSavingDescription(true);
		try {
			const response = await fetch(
				`/api/meetings/${meetingId}/charts/${chartId}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ description: descriptionDraft }),
				},
			);
			if (!response.ok) {
				const result = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				setError(result.error ?? "説明を保存できませんでした。");
				return;
			}
			setChartRecord({ ...chartRecord, description: descriptionDraft });
			setIsEditingDescription(false);
			setError("");
		} catch {
			setError("説明を保存できませんでした。通信状態を確認してください。");
		} finally {
			setIsSavingDescription(false);
		}
	}

	async function deleteChart() {
		setIsDeletingChart(true);
		try {
			const response = await fetch(
				`/api/meetings/${meetingId}/charts/${chartId}`,
				{ method: "DELETE" },
			);
			if (!response.ok) {
				const result = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				setError(result.error ?? "譜面を削除できませんでした。");
				return;
			}
			router.push(`/feedback/${meetingId}`);
		} catch {
			setError("譜面を削除できませんでした。通信状態を確認してください。");
		} finally {
			setIsDeletingChart(false);
		}
	}

	async function deleteComment(comment: Comment) {
		setIsDeletingComment(true);
		try {
			const response = await fetch(
				`/api/meetings/${meetingId}/charts/${chartId}/comments`,
				{
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ commentId: comment.id }),
				},
			);
			if (!response.ok) {
				const result = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				setError(result.error ?? "コメントを削除できませんでした。");
				return;
			}
			setComments((current) =>
				current.filter((entry) => entry.id !== comment.id),
			);
			setPendingCommentDeletion(undefined);
		} catch {
			setError("コメントを削除できませんでした。");
		} finally {
			setIsDeletingComment(false);
		}
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
					<p className="mt-1 text-sm text-slate-500">
						投稿者: {chartRecord.uploadedBy || "不明"}
					</p>
					{isEditingDescription ? (
						<div className="mt-2 max-w-3xl">
							<textarea
								aria-label="譜面の説明"
								className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
								onChange={(event) => setDescriptionDraft(event.target.value)}
								rows={3}
								value={descriptionDraft}
							/>
							<div className="mt-2 flex gap-3">
								<button
									className="text-sm font-medium text-sky-800 disabled:opacity-50"
									disabled={isSavingDescription}
									onClick={() => void saveDescription()}
									type="button"
								>
									{isSavingDescription ? "保存中…" : "説明を保存"}
								</button>
								<button
									className="text-sm text-slate-500"
									disabled={isSavingDescription}
									onClick={() => setIsEditingDescription(false)}
									type="button"
								>
									キャンセル
								</button>
							</div>
						</div>
					) : (
						<div className="mt-2">
							<p
								className={
									chartRecord.description
										? "max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600"
										: "text-sm text-slate-400"
								}
							>
								{chartRecord.description || "説明なし"}
							</p>
							<button
								className="mt-1 text-sm text-sky-700 hover:text-sky-900"
								onClick={() => {
									setDescriptionDraft(chartRecord.description);
									setIsEditingDescription(true);
								}}
								type="button"
							>
								説明を編集
							</button>
						</div>
					)}
				</div>
				<div className="flex flex-col items-stretch gap-3">
					<button
						className={
							isPassed
								? "rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-800"
								: "rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
						}
						onClick={() => setIsPassConfirmationOpen(true)}
						type="button"
					>
						{isPassed ? "合格を取り消す" : "合格にする"}
					</button>
					<a
						className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
						href={`/api/meetings/${meetingId}/charts/${chartId}/file`}
					>
						譜面をダウンロード
					</a>
					{!isPassed && (
						<button
							className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
							onClick={() => setIsDeleteConfirmationOpen(true)}
							type="button"
						>
							譜面を削除
						</button>
					)}
				</div>
			</div>
			<ChartVotePanel
				displayName={displayName}
				isSaving={isSavingVote}
				onVote={(vote) => void castVote(vote)}
				votes={chartRecord.votes}
			/>
			<ConfirmationDialog
				confirmLabel="譜面とコメントを削除"
				description="この会から譜面を削除します。譜面に付いたコメントも削除されます。"
				isPending={isDeletingChart}
				onCancel={() => setIsDeleteConfirmationOpen(false)}
				onConfirm={() => void deleteChart()}
				open={isDeleteConfirmationOpen}
				title="譜面を削除しますか？"
			/>
			<ConfirmationDialog
				confirmLabel={isPassed ? "合格を取り消す" : "合格にする"}
				description={
					isPassed
						? "この譜面の合格を取り消します。進捗に反映されます。"
						: "この譜面を合格として記録し、以後の譜面追加候補から除外します。"
				}
				isPending={isUpdatingPass}
				onCancel={() => setIsPassConfirmationOpen(false)}
				onConfirm={() => void togglePassed()}
				open={isPassConfirmationOpen}
				title={isPassed ? "合格を取り消しますか？" : "譜面を合格にしますか？"}
			/>
			<ConfirmationDialog
				confirmLabel="コメントを削除"
				description="このコメントを削除します。この操作は元に戻せません。"
				isPending={isDeletingComment}
				onCancel={() => setPendingCommentDeletion(undefined)}
				onConfirm={() =>
					pendingCommentDeletion && void deleteComment(pendingCommentDeletion)
				}
				open={Boolean(pendingCommentDeletion)}
				title="コメントを削除しますか？"
			/>
			{error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
			<div>
				<ChartPlayback
					allowLocalAudioSelection={false}
					chart={chart}
					audioSource={music.audio?.url}
					comments={chartComments}
					commentListEnabled
					onCommentDelete={(comment) =>
						setPendingCommentDeletion(
							comments.find((entry) => entry.id === comment.id),
						)
					}
					commentComposer={
						commentLanePosition === null
							? undefined
							: {
									isSaving: isSavingComment,
									lanePosition: commentLanePosition,
									onBodyChange: setCommentBody,
									onCancel: () => setCommentLanePosition(null),
									onSubmit: () => void addComment(),
									position: commentPosition,
									body: commentBody,
								}
					}
					onCommentSelect={(comment) => setPosition(comment.position)}
					onCommentPositionChange={(nextPosition, lanePosition) => {
						setCommentPosition(nextPosition);
						setCommentLanePosition(lanePosition);
						setCommentBody("");
					}}
					onPositionChange={setPosition}
					position={position}
				/>
			</div>
		</div>
	);
}
