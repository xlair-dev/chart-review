"use client";

import { useEffect, useRef, useState } from "react";
import { ChartRenderer } from "@/components/viewer/chart-renderer";
import type { ChartData } from "@/lib/chart-model";
import {
	audioSecondsAtBeat,
	positionAtAudioSeconds,
	positionAtSeconds,
	secondsAtBeat,
	supportsChartTiming,
} from "@/lib/chart-timing";

export function ChartPlayback({
	chart,
	audioSource,
	initialPosition = 0,
	position: controlledPosition,
	onPositionChange,
}: {
	chart: ChartData;
	audioSource?: string | null;
	initialPosition?: number;
	position?: number;
	onPositionChange?: (position: number) => void;
}) {
	const audio = useRef<HTMLAudioElement>(null);
	const playbackFrame = useRef<number | undefined>(undefined);
	const chartLeadIn = useRef<
		{ chartSeconds: number; startedAt: number; wasMuted: boolean } | undefined
	>(undefined);
	const [localAudioUrl, setLocalAudioUrl] = useState<string>();
	const [localPosition, setLocalPosition] = useState(initialPosition);
	const [isChartLeadIn, setIsChartLeadIn] = useState(false);
	const position = controlledPosition ?? localPosition;
	const source = localAudioUrl ?? audioSource;
	const canPlay = supportsChartTiming(chart);

	useEffect(() => {
		if (!localAudioUrl) return;
		return () => URL.revokeObjectURL(localAudioUrl);
	}, [localAudioUrl]);
	useEffect(() => {
		if (
			controlledPosition === undefined ||
			!audio.current ||
			audio.current.readyState === 0 ||
			!canPlay
		) {
			return;
		}
		const targetTime = audioSecondsAtBeat(chart, controlledPosition);
		if (Math.abs(audio.current.currentTime - targetTime) > 0.25) {
			audio.current.currentTime = targetTime;
		}
	}, [chart, canPlay, controlledPosition]);
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
			if (audio.current.paused) void audio.current.play();
			else audio.current.pause();
		}
		window.addEventListener("keydown", handleSpace);
		return () => window.removeEventListener("keydown", handleSpace);
	}, [source]);

	function changePosition(beat: number) {
		setLocalPosition(beat);
		onPositionChange?.(beat);
	}

	function chooseAudio(file?: File) {
		setLocalAudioUrl(file ? URL.createObjectURL(file) : undefined);
		changePosition(0);
	}

	function seek(beat: number) {
		changePosition(beat);
		const player = audio.current;
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
		if (!player || player.paused) {
			playbackFrame.current = undefined;
			return;
		}
		const leadIn = chartLeadIn.current;
		if (leadIn) {
			const chartSeconds =
				leadIn.chartSeconds + (performance.now() - leadIn.startedAt) / 1000;
			const audioOffset = chart.audioOffsetSeconds ?? 0;
			if (chartSeconds < audioOffset) {
				changePosition(positionAtSeconds(chart, chartSeconds));
			} else {
				chartLeadIn.current = undefined;
				player.currentTime = 0;
				player.muted = leadIn.wasMuted;
				setIsChartLeadIn(false);
				changePosition(positionAtAudioSeconds(chart, 0));
			}
			playbackFrame.current = requestAnimationFrame(syncPlaybackPosition);
			return;
		}
		changePosition(positionAtAudioSeconds(chart, player.currentTime));
		playbackFrame.current = requestAnimationFrame(syncPlaybackPosition);
	}

	function startPlaybackSync() {
		const player = audio.current;
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
							{audioSource
								? "server から同期した音源を再生します。"
								: "選択した音源はこのブラウザー内だけで使います。"}
							譜面に記録された音源オフセットに合わせて同期します。
						</p>
					</div>
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
				</div>
				{source && canPlay ? (
					// biome-ignore lint/a11y/useMediaCaption: The selected file is music for chart timing and has no dialogue.
					<audio
						className="mt-4 w-full"
						controls
						onEnded={stopPlaybackSync}
						onLoadedMetadata={(event) => {
							event.currentTarget.currentTime = audioSecondsAtBeat(
								chart,
								position,
							);
						}}
						onPause={stopPlaybackSync}
						onPlay={startPlaybackSync}
						onTimeUpdate={(event) => {
							syncPositionFromAudio(event.currentTarget.currentTime);
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
				onPositionChange={seek}
				position={position}
			/>
		</div>
	);
}
