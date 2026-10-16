"use client";

import type { ChartData } from "@xlair-dev/chart-viewer";
import { ChartViewer } from "@xlair-dev/chart-viewer";
import { useState } from "react";
import { CommentBody } from "@/components/feedback/comment-body";

export interface ChartComment {
	id: string;
	displayName: string;
	position: number;
	lanePosition: number;
	body: string;
}

export interface ChartCommentComposer {
	position: number;
	lanePosition: number;
	body: string;
	isSaving: boolean;
	onBodyChange: (body: string) => void;
	onSubmit: () => void;
	onCancel: () => void;
}

export function ChartRenderer({
	chart,
	position,
	onPositionChange,
	onCommentPositionChange,
	onCommentDelete,
	onCommentSelect,
	commentComposer,
	comments = [],
	commentListEnabled = false,
	noteSpeed = 1,
	displayNoteSpeed,
	onNoteSpeedChange,
	onNoteSpeedCommit,
	isPlaying = false,
}: {
	chart: ChartData;
	position?: number;
	onPositionChange?: (position: number) => void;
	onCommentPositionChange?: (position: number, lanePosition: number) => void;
	onCommentDelete?: (comment: ChartComment) => void;
	onCommentSelect?: (comment: ChartComment) => void;
	commentComposer?: ChartCommentComposer;
	comments?: ChartComment[];
	commentListEnabled?: boolean;
	noteSpeed?: number;
	displayNoteSpeed?: string;
	onNoteSpeedChange?: (speed: string) => void;
	onNoteSpeedCommit?: () => void;
	isPlaying?: boolean;
}) {
	const [isCommentListOpen, setIsCommentListOpen] = useState(true);

	return (
		<ChartViewer
			chart={chart}
			mode="both"
			showSeekBar
			noteSpeed={noteSpeed}
			displayNoteSpeed={displayNoteSpeed}
			onNoteSpeedChange={onNoteSpeedChange}
			onNoteSpeedCommit={onNoteSpeedCommit}
			onPositionChange={onPositionChange}
			onSheetPositionSelect={onCommentPositionChange}
			position={position}
			sheetOverlay={(geometry) =>
				!isPlaying &&
				comments.map((comment) => (
					<div
						className="absolute z-10 w-max max-w-[min(28rem,80%)] break-words rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2 text-left text-xs text-slate-800 shadow-lg backdrop-blur-sm [overflow-wrap:anywhere]"
						key={comment.id}
						style={{
							top: geometry.positionStyle(comment.position),
							left: geometry.laneStyle(comment.lanePosition),
							transform: geometry.laneTransform(comment.lanePosition),
						}}
					>
						<strong className="block text-sky-900">
							{comment.displayName}
						</strong>
						<span className="mt-1 block whitespace-pre-wrap leading-5">
							<CommentBody text={comment.body} />
						</span>
						{onCommentDelete && (
							<button
								aria-label="コメントを削除"
								className="mt-1 text-[10px] text-slate-500 underline hover:text-rose-700"
								onClick={(event) => {
									event.stopPropagation();
									onCommentDelete(comment);
								}}
								type="button"
							>
								削除
							</button>
						)}
					</div>
				))
			}
			sheetFooter={(geometry) =>
				commentComposer && (
					<div className="absolute inset-x-4 bottom-4 z-20 rounded-xl border border-sky-200 bg-white/95 p-4 text-slate-900 shadow-xl backdrop-blur-sm">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="text-sm font-semibold">この位置にコメント</p>
								<p className="mt-1 text-xs text-slate-500">
									{geometry.formatPosition(commentComposer.position)} ・ レーン{" "}
									{commentComposer.lanePosition.toFixed(1)}
								</p>
							</div>
							<button
								className="text-sm text-slate-500 hover:text-slate-800"
								onClick={commentComposer.onCancel}
								type="button"
							>
								閉じる
							</button>
						</div>
						<textarea
							className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-sm"
							maxLength={2000}
							onChange={(event) =>
								commentComposer.onBodyChange(event.target.value)
							}
							placeholder="気づいた点を書く"
							required
							rows={3}
							value={commentComposer.body}
						/>
						<button
							className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
							disabled={
								commentComposer.isSaving || !commentComposer.body.trim()
							}
							onClick={commentComposer.onSubmit}
							type="button"
						>
							{commentComposer.isSaving ? "保存中…" : "コメントを追加"}
						</button>
					</div>
				)
			}
			sidePanel={(geometry) =>
				commentListEnabled && (
					<aside
						className={
							isCommentListOpen
								? "rounded-2xl border border-slate-200 bg-white p-4"
								: "rounded-2xl border border-sky-300 bg-sky-50/30 shadow-sm"
						}
					>
						{isCommentListOpen ? (
							<>
								<div className="flex items-center justify-between gap-3">
									<h2 className="text-sm font-semibold text-slate-800">
										コメント一覧
									</h2>
									<button
										aria-label="コメント一覧を縮小"
										className="text-lg text-sky-700 hover:text-sky-900"
										onClick={() => setIsCommentListOpen(false)}
										type="button"
									>
										&raquo;
									</button>
								</div>
								{comments.length === 0 ? (
									<p className="mt-4 text-sm text-slate-500">
										コメントはまだありません。
									</p>
								) : (
									<ul className="mt-3 divide-y divide-slate-100">
										{comments.map((comment) => (
											<li
												key={comment.id}
												className="py-3 first:pt-0 last:pb-0"
											>
												<button
													className="block w-full rounded-lg text-left hover:bg-sky-50 hover:text-sky-900"
													onClick={() => onCommentSelect?.(comment)}
													type="button"
												>
													<strong className="block text-sm text-slate-800">
														{comment.displayName}
													</strong>
													<span className="mt-1 block text-xs text-slate-400">
														{geometry.formatPosition(comment.position)} ・
														レーン {comment.lanePosition.toFixed(1)}
													</span>
												</button>
												<div className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-600">
													<CommentBody text={comment.body} />
												</div>
											</li>
										))}
									</ul>
								)}
							</>
						) : (
							<button
								aria-label="コメント一覧を展開"
								className="flex h-full min-h-24 w-full items-center justify-center rounded-2xl text-lg text-sky-800 transition hover:bg-sky-100 hover:text-sky-900"
								onClick={() => setIsCommentListOpen(true)}
								type="button"
							>
								&laquo;
							</button>
						)}
					</aside>
				)
			}
		/>
	);
}
