"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	type ChartComment,
	type ChartCommentComposer,
	ChartRenderer,
} from "@/components/viewer/chart-renderer";
import { chartSoundPlan, type JudgmentSound } from "@/lib/chart-judgments";
import type { ChartData } from "@/lib/chart-model";
import {
	audioSecondsAtBeat,
	positionAtAudioSeconds,
	positionAtSeconds,
	secondsAtBeat,
	supportsChartTiming,
} from "@/lib/chart-timing";

function requestAudioPlay(player: HTMLAudioElement) {
	void player.play().catch((error: unknown) => {
		if (error instanceof DOMException && error.name === "AbortError") return;
		console.error("Audio playback failed", error);
	});
}

const judgmentSoundSources: Record<JudgmentSound, string> = {
	tap: "/sounds/judgments/tap.wav",
	xTap: "/sounds/judgments/x-tap.wav",
	flick: "/sounds/judgments/flick.wav",
	sideTap: "/sounds/judgments/side-tap.wav",
	hold: "/sounds/judgments/hold.wav",
	sideHold: "/sounds/judgments/side-hold.wav",
	slideHold: "/sounds/judgments/slide-hold.wav",
};

export function ChartPlayback({
	chart,
	audioSource,
	initialPosition = 0,
	position: controlledPosition,
	onPositionChange,
	onCommentPositionChange,
	onCommentDelete,
	onCommentSelect,
	commentComposer,
	comments = [],
	allowLocalAudioSelection = true,
	commentListEnabled = false,
	audioSourceLabel,
}: {
	chart: ChartData;
	audioSource?: string | null;
	initialPosition?: number;
	position?: number;
	onPositionChange?: (position: number) => void;
	onCommentPositionChange?: (position: number, lanePosition: number) => void;
	onCommentDelete?: (comment: ChartComment) => void;
	onCommentSelect?: (comment: ChartComment) => void;
	commentComposer?: ChartCommentComposer;
	comments?: ChartComment[];
	allowLocalAudioSelection?: boolean;
	commentListEnabled?: boolean;
	audioSourceLabel?: string;
}) {
	const audio = useRef<HTMLAudioElement>(null);
	const playbackFrame = useRef<number | undefined>(undefined);
	const soundPlan = useMemo(() => chartSoundPlan(chart), [chart]);
	const judgmentEvents = soundPlan.judgments;
	const judgmentCursor = useRef(0);
	const lastJudgmentPosition = useRef<number | undefined>(undefined);
	const sustainedSoundCursor = useRef(0);
	const activeSustainedSounds = useRef({ sideHold: 0, slideHold: 0 });
	const judgmentPlayers = useRef<
		Partial<Record<JudgmentSound, HTMLAudioElement>>
	>({});
	const chartLeadIn = useRef<
		{ chartSeconds: number; startedAt: number; wasMuted: boolean } | undefined
	>(undefined);
	const [localAudioUrl, setLocalAudioUrl] = useState<string>();
	const [localPosition, setLocalPosition] = useState(initialPosition);
	const [isChartLeadIn, setIsChartLeadIn] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [noteSpeed, setNoteSpeed] = useState(1);
	const [noteSpeedInput, setNoteSpeedInput] = useState("1.00");
	const renderNoteSpeed = noteSpeed * 2.6;
	const position = controlledPosition ?? localPosition;
	const source = localAudioUrl ?? audioSource;
	const canPlay = supportsChartTiming(chart);

	useEffect(() => {
		const players: Partial<Record<JudgmentSound, HTMLAudioElement>> = {};
		const sounds = new Set(judgmentEvents.map((judgment) => judgment.sound));
		if (soundPlan.sustainedTransitions.length > 0) {
			sounds.add("sideHold");
			sounds.add("slideHold");
		}
		for (const sound of sounds) {
			const source = judgmentSoundSources[sound];
			const player = new Audio(source);
			player.preload = "auto";
			player.volume = 0.35;
			player.loop = sound === "sideHold" || sound === "slideHold";
			player.load();
			players[sound] = player;
		}
		judgmentPlayers.current = players;
		return () => {
			for (const player of Object.values(players)) player?.pause();
			judgmentPlayers.current = {};
		};
	}, [judgmentEvents, soundPlan]);

	useEffect(() => {
		if (!localAudioUrl) return;
		return () => URL.revokeObjectURL(localAudioUrl);
	}, [localAudioUrl]);
	useEffect(() => {
		if (
			controlledPosition === undefined ||
			!audio.current ||
			audio.current.readyState === 0 ||
			!canPlay ||
			isChartLeadIn
		) {
			return;
		}
		const targetTime = audioSecondsAtBeat(chart, controlledPosition);
		if (Math.abs(audio.current.currentTime - targetTime) > 0.25) {
			audio.current.currentTime = targetTime;
		}
	}, [chart, canPlay, controlledPosition, isChartLeadIn]);
	useEffect(
		() => () => {
			if (playbackFrame.current !== undefined)
				cancelAnimationFrame(playbackFrame.current);
		},
		[],
	);

	useEffect(() => {
		function handleSpace(event: KeyboardEvent) {
			if (
				event.code !== "Space" ||
				event.repeat ||
				(event.target instanceof HTMLElement &&
					(event.target.isContentEditable ||
						["INPUT", "TEXTAREA", "BUTTON", "SELECT"].includes(
							event.target.tagName,
						)))
			) {
				return;
			}
			if (!audio.current || !source) return;
			event.preventDefault();
			if (audio.current.paused) requestAudioPlay(audio.current);
			else audio.current.pause();
		}
		window.addEventListener("keydown", handleSpace);
		return () => window.removeEventListener("keydown", handleSpace);
	}, [source]);

	function changePosition(beat: number) {
		setLocalPosition(beat);
		onPositionChange?.(beat);
	}

	function resetJudgmentPlayback(beat: number, includeCurrent: boolean) {
		let low = 0;
		let high = judgmentEvents.length;
		while (low < high) {
			const middle = (low + high) >>> 1;
			if (judgmentEvents[middle].beat < beat) low = middle + 1;
			else high = middle;
		}
		judgmentCursor.current = low;
		lastJudgmentPosition.current = includeCurrent ? beat - 0.000001 : beat;
	}

	function playJudgmentsThrough(beat: number) {
		const previous = lastJudgmentPosition.current;
		while (
			judgmentCursor.current < judgmentEvents.length &&
			judgmentEvents[judgmentCursor.current].beat <= beat
		) {
			const judgment = judgmentEvents[judgmentCursor.current];
			if (previous !== undefined && judgment.beat > previous) {
				const player = judgmentPlayers.current[judgment.sound];
				if (player) {
					player.currentTime = 0;
					requestAudioPlay(player);
				}
			}
			judgmentCursor.current += 1;
		}
		lastJudgmentPosition.current = beat;
	}

	function syncSustainedSounds() {
		for (const sound of ["sideHold", "slideHold"] as const) {
			const player = judgmentPlayers.current[sound];
			if (!player) continue;
			const count = activeSustainedSounds.current[sound];
			const playbackActive = audio.current !== null && !audio.current.paused;
			if (count > 0 && playbackActive && player.paused) {
				player.currentTime = 0;
				requestAudioPlay(player);
			} else if ((!playbackActive || count === 0) && !player.paused) {
				player.pause();
				player.currentTime = 0;
			}
		}
	}

	function resetSustainedSoundPlayback(beat: number) {
		let low = 0;
		let high = soundPlan.sustainedTransitions.length;
		while (low < high) {
			const middle = (low + high) >>> 1;
			if (soundPlan.sustainedTransitions[middle].beat <= beat) low = middle + 1;
			else high = middle;
		}
		sustainedSoundCursor.current = low;
		const current = soundPlan.sustainedTransitions[low - 1];
		activeSustainedSounds.current = {
			sideHold: current?.sideHoldCount ?? 0,
			slideHold: current?.slideHoldCount ?? 0,
		};
		syncSustainedSounds();
	}

	function updateSustainedSoundsThrough(beat: number) {
		while (
			sustainedSoundCursor.current < soundPlan.sustainedTransitions.length &&
			soundPlan.sustainedTransitions[sustainedSoundCursor.current].beat <= beat
		) {
			const transition =
				soundPlan.sustainedTransitions[sustainedSoundCursor.current];
			activeSustainedSounds.current = {
				sideHold: transition.sideHoldCount,
				slideHold: transition.slideHoldCount,
			};
			sustainedSoundCursor.current += 1;
		}
		syncSustainedSounds();
	}

	function chooseAudio(file?: File) {
		setLocalAudioUrl(file ? URL.createObjectURL(file) : undefined);
		changePosition(0);
	}

	function changeNoteSpeedInput(value: string) {
		setNoteSpeedInput(value);
		if (!value.trim()) return;
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			setNoteSpeed(Math.min(2, Math.max(0.5, parsed)));
		}
	}

	function commitNoteSpeedInput() {
		const parsed = Number(noteSpeedInput);
		if (!Number.isFinite(parsed)) {
			setNoteSpeedInput(noteSpeed.toFixed(2));
			return;
		}
		const nextSpeed = Math.min(2, Math.max(0.5, parsed));
		setNoteSpeed(nextSpeed);
		setNoteSpeedInput(nextSpeed.toFixed(2));
	}

	function seek(beat: number) {
		changePosition(beat);
		resetJudgmentPlayback(beat, false);
		const player = audio.current;
		resetSustainedSoundPlayback(beat);
		if (player && player.readyState > 0 && canPlay) {
			const audioSeconds = audioSecondsAtBeat(chart, beat);
			if (
				!player.paused &&
				audioSeconds === 0 &&
				(chart.audioOffsetSeconds ?? 0) > 0
			) {
				startChartLeadIn(beat, player);
			} else {
				if (chartLeadIn.current) {
					player.muted = chartLeadIn.current.wasMuted;
					chartLeadIn.current = undefined;
					setIsChartLeadIn(false);
				}
				player.currentTime = audioSeconds;
			}
		}
	}

	function startChartLeadIn(beat: number, player: HTMLAudioElement) {
		const currentLeadIn = chartLeadIn.current;
		chartLeadIn.current = {
			chartSeconds: secondsAtBeat(chart, beat),
			startedAt: performance.now(),
			wasMuted: currentLeadIn?.wasMuted ?? player.muted,
		};
		player.currentTime = 0;
		player.muted = true;
		setIsChartLeadIn(true);
	}

	function syncPlaybackPosition() {
		const player = audio.current;
		if (!player) {
			playbackFrame.current = undefined;
			return;
		}
		const leadIn = chartLeadIn.current;
		if (leadIn) {
			const chartSeconds =
				leadIn.chartSeconds + (performance.now() - leadIn.startedAt) / 1000;
			const audioOffset = chart.audioOffsetSeconds ?? 0;
			if (chartSeconds < audioOffset) {
				const beat = positionAtSeconds(chart, chartSeconds);
				playJudgmentsThrough(beat);
				updateSustainedSoundsThrough(beat);
				changePosition(beat);
			} else {
				chartLeadIn.current = undefined;
				player.muted = true;
				const wasPaused = player.paused;
				const finishAudioSeek = () => {
					player.muted = leadIn.wasMuted;
					if (wasPaused) requestAudioPlay(player);
				};
				if (player.currentTime < 0.001) {
					finishAudioSeek();
				} else {
					player.addEventListener("seeked", finishAudioSeek, { once: true });
				}
				player.currentTime = 0;
				setIsChartLeadIn(false);
				changePosition(positionAtAudioSeconds(chart, 0));
			}
			playbackFrame.current = requestAnimationFrame(syncPlaybackPosition);
			return;
		}
		if (player.paused) {
			playbackFrame.current = undefined;
			return;
		}
		const beat = positionAtAudioSeconds(chart, player.currentTime);
		playJudgmentsThrough(beat);
		updateSustainedSoundsThrough(beat);
		changePosition(beat);
		playbackFrame.current = requestAnimationFrame(syncPlaybackPosition);
	}

	function startPlaybackSync() {
		const player = audio.current;
		resetJudgmentPlayback(
			chartLeadIn.current
				? positionAtSeconds(chart, chartLeadIn.current.chartSeconds)
				: player
					? positionAtAudioSeconds(chart, player.currentTime)
					: position,
			true,
		);
		resetSustainedSoundPlayback(
			chartLeadIn.current
				? positionAtSeconds(chart, chartLeadIn.current.chartSeconds)
				: player
					? positionAtAudioSeconds(chart, player.currentTime)
					: position,
		);
		const audioOffset = chart.audioOffsetSeconds ?? 0;
		if (
			player &&
			audioOffset > 0 &&
			secondsAtBeat(chart, position) < audioOffset
		) {
			startChartLeadIn(position, player);
		}
		if (playbackFrame.current !== undefined)
			cancelAnimationFrame(playbackFrame.current);
		playbackFrame.current = requestAnimationFrame(syncPlaybackPosition);
	}

	function stopPlaybackSync() {
		if (playbackFrame.current !== undefined)
			cancelAnimationFrame(playbackFrame.current);
		playbackFrame.current = undefined;
		for (const sound of ["sideHold", "slideHold"] as const) {
			const soundPlayer = judgmentPlayers.current[sound];
			soundPlayer?.pause();
		}
		const player = audio.current;
		if (!player) return;
		const leadIn = chartLeadIn.current;
		if (leadIn) {
			const chartSeconds = Math.min(
				chart.audioOffsetSeconds ?? 0,
				leadIn.chartSeconds + (performance.now() - leadIn.startedAt) / 1000,
			);
			chartLeadIn.current = undefined;
			player.currentTime = 0;
			player.muted = leadIn.wasMuted;
			setIsChartLeadIn(false);
			changePosition(positionAtSeconds(chart, chartSeconds));
			return;
		}
		changePosition(positionAtAudioSeconds(chart, player.currentTime));
	}

	function syncPositionFromAudio(seconds: number) {
		const player = audio.current;
		if (chartLeadIn.current) return;
		if (
			player?.paused &&
			seconds === 0 &&
			(chart.audioOffsetSeconds ?? 0) > 0 &&
			secondsAtBeat(chart, position) < (chart.audioOffsetSeconds ?? 0)
		) {
			return;
		}
		changePosition(positionAtAudioSeconds(chart, seconds));
	}

	return (
		<div className="space-y-5">
			<section className="rounded-2xl border border-slate-200 bg-white p-5">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h2 className="text-base font-semibold">音源と再生</h2>
						<p className="mt-1 text-sm text-slate-600">
							{audioSourceLabel ??
								(audioSource
									? "server から同期した音源を再生します。"
									: "選択した音源はこのブラウザー内だけで使います。")}
							譜面に記録された音源オフセットに合わせて同期します。
						</p>
					</div>
					{allowLocalAudioSelection && (
						<label className="cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
							音源を選択
							<input
								accept="audio/*"
								className="sr-only"
								disabled={!canPlay}
								onChange={(event) => chooseAudio(event.target.files?.[0])}
								type="file"
							/>
						</label>
					)}
				</div>
				{source && canPlay ? (
					// biome-ignore lint/a11y/useMediaCaption: The selected file is music for chart timing and has no dialogue.
					<audio
						className="mt-4 w-full"
						controls
						onEnded={() => {
							setIsPlaying(false);
							if (!chartLeadIn.current) stopPlaybackSync();
						}}
						onLoadedMetadata={(event) => {
							event.currentTarget.currentTime = audioSecondsAtBeat(
								chart,
								position,
							);
						}}
						onPause={(event) => {
							setIsPlaying(false);
							if (chartLeadIn.current && event.currentTarget.ended) return;
							stopPlaybackSync();
						}}
						onPlay={() => {
							setIsPlaying(true);
							startPlaybackSync();
						}}
						onTimeUpdate={(event) => {
							syncPositionFromAudio(event.currentTarget.currentTime);
						}}
						onSeeking={(event) => {
							if (chartLeadIn.current) return;
							const beat = positionAtAudioSeconds(
								chart,
								event.currentTarget.currentTime,
							);
							resetJudgmentPlayback(beat, false);
							resetSustainedSoundPlayback(beat);
						}}
						ref={audio}
						src={source}
					/>
				) : (
					<p className="mt-4 text-sm text-slate-500">
						{audioSource
							? "同期済み音源を再生できます。"
							: "音源を選択すると再生できます。"}
					</p>
				)}
				{isChartLeadIn && (
					<p className="mt-2 text-sm text-sky-700" role="status">
						譜面を先行して再生中です。音源は譜面のオフセット後に始まります。
					</p>
				)}
				{!canPlay && (
					<p className="mt-3 text-sm text-amber-700">
						譜面の 0 拍目の BPM が分からないため、音源との同期はできません。
					</p>
				)}
			</section>
			<ChartRenderer
				chart={chart}
				comments={comments}
				commentListEnabled={commentListEnabled}
				commentComposer={commentComposer}
				noteSpeed={renderNoteSpeed}
				onCommentDelete={onCommentDelete}
				onCommentPositionChange={onCommentPositionChange}
				onCommentSelect={onCommentSelect}
				isPlaying={isPlaying || isChartLeadIn}
				displayNoteSpeed={noteSpeedInput}
				onNoteSpeedChange={changeNoteSpeedInput}
				onNoteSpeedCommit={commitNoteSpeedInput}
				onPositionChange={seek}
				position={position}
			/>
		</div>
	);
}
