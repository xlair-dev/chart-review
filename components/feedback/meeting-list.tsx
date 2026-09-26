"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface MeetingSummary {
	id: string;
	heldOn: string;
	passedCount: number;
	totalCount: number;
	chartCount: number;
}

async function responseError(response: Response): Promise<string> {
	const body = (await response.json().catch(() => ({}))) as { error?: string };
	return body.error ?? "処理に失敗しました。";
}

export function MeetingList() {
	const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
	const [heldOn, setHeldOn] = useState(new Date().toLocaleDateString("sv-SE"));
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [isCreating, setIsCreating] = useState(false);

	const reloadMeetings = useCallback(async () => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/meetings", { cache: "no-store" });
			if (!response.ok) {
				setError(await responseError(response));
				return;
			}
			setMeetings((await response.json()) as MeetingSummary[]);
			setError("");
		} catch {
			setError(
				"FB 会の一覧を読み込めませんでした。通信状態を確認してください。",
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void reloadMeetings();
	}, [reloadMeetings]);

	async function createMeeting(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsCreating(true);
		try {
			const response = await fetch("/api/meetings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ heldOn }),
			});
			if (!response.ok) {
				setError(await responseError(response));
				return;
			}
			await reloadMeetings();
		} catch {
			setError("FB 会を作成できませんでした。通信状態を確認してください。");
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<div className="space-y-8">
			<section className="rounded-2xl border border-slate-200 bg-white p-6">
				<div className="flex flex-wrap items-end justify-between gap-5">
					<div>
						<p className="text-xs font-semibold tracking-[0.18em] text-sky-700">
							FEEDBACK SESSIONS
						</p>
						<h2 className="mt-2 text-2xl font-semibold">フィードバック会</h2>
					</div>
					<form
						className="flex flex-wrap items-end gap-3"
						onSubmit={createMeeting}
					>
						<label className="text-sm text-slate-600">
							開催日
							<input
								className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
								onChange={(event) => setHeldOn(event.target.value)}
								required
								type="date"
								value={heldOn}
							/>
						</label>
						<button
							className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
							disabled={isCreating}
							type="submit"
						>
							{isCreating ? "作成中…" : "会を作成"}
						</button>
					</form>
				</div>
				{error && <p className="mt-5 text-sm text-rose-700">{error}</p>}
			</section>

			{isLoading ? (
				<p className="py-8 text-center text-sm text-slate-500">読み込み中…</p>
			) : meetings.length === 0 ? (
				<p className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">
					まだフィードバック会がありません。
				</p>
			) : (
				<div className="grid gap-4">
					{meetings.map((meeting) => {
						const progress =
							meeting.totalCount === 0
								? 0
								: Math.min(
										100,
										(meeting.passedCount / meeting.totalCount) * 100,
									);
						return (
							<Link
								className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-sky-300"
								href={`/feedback/${meeting.id}`}
								key={meeting.id}
							>
								<div className="flex flex-wrap items-baseline justify-between gap-3">
									<h3 className="text-lg font-semibold">
										{meeting.heldOn} の会
									</h3>
									<span className="text-sm text-slate-500">
										{meeting.chartCount} 譜面
									</span>
								</div>
								<div className="mt-5 flex items-center gap-3">
									<div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
										<div
											className="h-full rounded-full bg-emerald-500"
											style={{ width: `${progress}%` }}
										/>
									</div>
									<span className="text-xs tabular-nums text-slate-500">
										{meeting.passedCount} / {meeting.totalCount} 合格
									</span>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
