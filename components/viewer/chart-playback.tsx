"use client";

import { useEffect, useRef, useState } from "react";
import { ChartRenderer } from "@/components/viewer/chart-renderer";
import type { ChartData } from "@/lib/chart-model";
import {
	positionAtSeconds,
	secondsAtBeat,
	supportsChartTiming,
} from "@/lib/chart-timing";

export function ChartPlayback({ chart }: { chart: ChartData }) {
	const audio = useRef<HTMLAudioElement>(null);
	const playbackFrame = useRef<number | undefined>(undefined);
	const [audioUrl, setAudioUrl] = useState<string>();
	const [position, setPosition] = useState(0);
	const canPlay = supportsChartTiming(chart);

	useEffect(() => {
		if (!audioUrl) return;
		return () => URL.revokeObjectURL(audioUrl);
	}, [audioUrl]);
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
			if (!audio.current || !audioUrl) return;
			event.preventDefault();
			if (audio.current.paused) void audio.current.play();
			else audio.current.pause();
		}
		window.addEventListener("keydown", handleSpace);
		return () => window.removeEventListener("keydown", handleSpace);
	}, [audioUrl]);

	function chooseAudio(file?: File) {
		setAudioUrl(file ? URL.createObjectURL(file) : undefined);
		setPosition(0);
	}

	function seek(beat: number) {
		setPosition(beat);
		if (audio.current && audio.current.readyState > 0 && canPlay) {
			audio.current.currentTime = secondsAtBeat(chart, beat);
		}
	}

	function syncPlaybackPosition() {
		const player = audio.current;
		if (!player || player.paused) {
			playbackFrame.current = undefined;
			return;
		}
		setPosition(positionAtSeconds(chart, player.currentTime));
		playbackFrame.current = requestAnimationFrame(syncPlaybackPosition);
	}

	function startPlaybackSync() {
		if (playbackFrame.current !== undefined)
			cancelAnimationFrame(playbackFrame.current);
		playbackFrame.current = requestAnimationFrame(syncPlaybackPosition);
	}

	function stopPlaybackSync() {
		if (playbackFrame.current !== undefined)
			cancelAnimationFrame(playbackFrame.current);
		playbackFrame.current = undefined;
		if (audio.current)
			setPosition(positionAtSeconds(chart, audio.current.currentTime));
	}

	return (
		<div className="space-y-5">
			<section className="rounded-2xl border border-slate-200 bg-white p-5">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h2 className="text-base font-semibold">音源と再生</h2>
						<p className="mt-1 text-sm text-slate-600">
							音源ファイルはこのブラウザー内だけで使います。譜面の 0
							拍目を音源の先頭に合わせます。
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
				{audioUrl ? (
					// biome-ignore lint/a11y/useMediaCaption: The selected file is music for chart timing and has no dialogue.
					<audio
						className="mt-4 w-full"
						controls
						onEnded={stopPlaybackSync}
						onLoadedMetadata={(event) => {
							event.currentTarget.currentTime = secondsAtBeat(chart, position);
						}}
						onPause={stopPlaybackSync}
						onPlay={startPlaybackSync}
						onTimeUpdate={(event) => {
							setPosition(
								positionAtSeconds(chart, event.currentTarget.currentTime),
							);
						}}
						ref={audio}
						src={audioUrl}
					/>
				) : (
					<p className="mt-4 text-sm text-slate-500">
						音源を選択すると再生できます。
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
