"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartData, Lane, Note } from "@/lib/chart-model";
import { positionValue } from "@/lib/chart-position";

const sideOrder = [
	"leftUpper",
	"leftLower",
	"rightLower",
	"rightUpper",
] as const;
const laneCount = 20;

function laneRange(lane: Lane): [number, number] {
	if (lane.type === "slider") {
		return [2 + lane.start, 2 + lane.start + lane.width];
	}
	const sideLanes: [number, number][] = [
		[0, 1],
		[1, 2],
		[18, 19],
		[19, 20],
	];
	return sideLanes[sideOrder.indexOf(lane.button)];
}

function noteColor(note: Note): string {
	switch (note.kind.type) {
		case "mine":
			return "#fb7185";
		case "hold":
		case "exHold":
		case "airHold":
			return "#34d399";
		case "slide":
		case "exSlide":
		case "airSlide":
		case "airCrush":
			return "#c084fc";
		case "exTap":
			return "#fbbf24";
		default:
			return "#38bdf8";
	}
}

function chartEnd(chart: ChartData): number {
	return Math.max(
		4,
		...chart.notes.flatMap((note) => [
			positionValue(note.position),
			...(note.kind.type === "hold" ||
			note.kind.type === "exHold" ||
			note.kind.type === "airHold"
				? [positionValue(note.kind.end)]
				: []),
			...(note.kind.type === "slide" || note.kind.type === "exSlide"
				? note.kind.points.map((point) => positionValue(point.position))
				: []),
			...(note.kind.type === "airSlide" || note.kind.type === "airCrush"
				? note.kind.points.map((point) => positionValue(point.position))
				: []),
		]),
	);
}

function pathPoints(note: Note): { position: number; lane: Lane }[] {
	if (note.kind.type === "slide" || note.kind.type === "exSlide") {
		return note.kind.points.map((point) => ({
			position: positionValue(point.position),
			lane: point.lane,
		}));
	}
	if (note.kind.type === "airSlide" || note.kind.type === "airCrush") {
		return note.kind.points.map((point) => ({
			position: positionValue(point.position),
			lane: point.lane,
		}));
	}
	return [];
}

function paintSheet(
	canvas: HTMLCanvasElement,
	chart: ChartData,
	currentBeat: number,
) {
	const context = canvas.getContext("2d");
	if (!context) return;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const ratio = window.devicePixelRatio || 1;
	canvas.width = width * ratio;
	canvas.height = height * ratio;
	context.scale(ratio, ratio);
	context.fillStyle = "#0f172a";
	context.fillRect(0, 0, width, height);
	const left = 34;
	const right = width - 18;
	const top = (canvas.parentElement?.clientHeight ?? 36) * 0.82;
	const end = chartEnd(chart);
	const bottom = top + height - (canvas.parentElement?.clientHeight ?? 0);
	const laneWidth = (right - left) / laneCount;

	for (let lane = 0; lane <= laneCount; lane++) {
		const x = left + lane * laneWidth;
		context.strokeStyle = lane === 2 || lane === 18 ? "#64748b" : "#334155";
		context.lineWidth = lane === 2 || lane === 18 ? 1.5 : 1;
		context.beginPath();
		context.moveTo(x, top);
		context.lineTo(x, bottom);
		context.stroke();
	}
	for (let beat = 0; beat <= end; beat++) {
		const y = top + (beat / end) * (bottom - top);
		context.strokeStyle = beat % 4 === 0 ? "#475569" : "#1e293b";
		context.beginPath();
		context.moveTo(left, y);
		context.lineTo(right, y);
		context.stroke();
	}

	for (const note of chart.notes) {
		const [startLane, endLane] = laneRange(note.lane);
		const x = left + startLane * laneWidth + 2;
		const noteWidth = Math.max(4, (endLane - startLane) * laneWidth - 4);
		const y = top + (positionValue(note.position) / end) * (bottom - top);
		const endPosition =
			"end" in note.kind ? positionValue(note.kind.end) : undefined;
		context.fillStyle = noteColor(note);
		const points = [
			{ position: positionValue(note.position), lane: note.lane },
			...pathPoints(note),
		];
		if (points.length > 1) {
			context.strokeStyle = noteColor(note);
			context.lineWidth = Math.max(3, laneWidth * 0.5);
			context.beginPath();
			points.forEach((point, index) => {
				const [pathStart, pathEnd] = laneRange(point.lane);
				const pathX = left + ((pathStart + pathEnd) / 2) * laneWidth;
				const pathY = top + (point.position / end) * (bottom - top);
				if (index === 0) context.moveTo(pathX, pathY);
				else context.lineTo(pathX, pathY);
			});
			context.stroke();
		}
		if (endPosition !== undefined) {
			const endY = top + (endPosition / end) * (bottom - top);
			context.globalAlpha = 0.45;
			context.fillRect(x + noteWidth * 0.35, y, noteWidth * 0.3, endY - y);
			context.globalAlpha = 1;
		}
		context.beginPath();
		context.roundRect(x, y - 5, noteWidth, 10, 4);
		context.fill();
	}
	const cursorY = top + (currentBeat / end) * (bottom - top);
	context.strokeStyle = "#fb7185";
	context.lineWidth = 2;
	context.beginPath();
	context.moveTo(left, cursorY);
	context.lineTo(right, cursorY);
	context.stroke();
}

function paintPlayfield(
	canvas: HTMLCanvasElement,
	chart: ChartData,
	currentBeat: number,
) {
	const context = canvas.getContext("2d");
	if (!context) return;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const ratio = window.devicePixelRatio || 1;
	canvas.width = width * ratio;
	canvas.height = height * ratio;
	context.scale(ratio, ratio);
	context.fillStyle = "#020617";
	context.fillRect(0, 0, width, height);
	const horizonY = height * 0.24;
	const floorY = height * 0.86;
	const horizonWidth = width * 0.34;
	const floorWidth = width * 0.94;
	const center = width / 2;
	const baseLaneX = (lane: number, y: number) => {
		const depth = (y - horizonY) / (floorY - horizonY);
		const fieldWidth = horizonWidth + (floorWidth - horizonWidth) * depth;
		return center - fieldWidth / 2 + (fieldWidth * lane) / 20;
	};
	const laneX = (lane: number, y: number) => {
		const depth = Math.max(
			0,
			Math.min(1, (y - horizonY) / (floorY - horizonY)),
		);
		const sideLaneWidth = (baseLaneX(2, y) - baseLaneX(1, y)) * 0.45 * depth;
		if (lane === 0) return baseLaneX(lane, y) - sideLaneWidth * 1.8;
		if (lane === 1) return baseLaneX(lane, y) - sideLaneWidth;
		if (lane === 19) return baseLaneX(lane, y) + sideLaneWidth;
		if (lane === 20) return baseLaneX(lane, y) + sideLaneWidth * 1.8;
		return baseLaneX(lane, y);
	};
	const drawLaneBand = (startLane: number, endLane: number, color: string) => {
		context.fillStyle = color;
		context.beginPath();
		context.moveTo(laneX(startLane, horizonY), horizonY);
		context.lineTo(laneX(endLane, horizonY), horizonY);
		context.lineTo(laneX(endLane, floorY), floorY);
		context.lineTo(laneX(startLane, floorY), floorY);
		context.closePath();
		context.fill();
	};
	drawLaneBand(0, 20, "#0f172a");
	drawLaneBand(2, 18, "#172554");
	for (const [startLane, endLane, color] of [
		[0, 1, "#312e81"],
		[1, 2, "#1e3a8a"],
		[18, 19, "#1e3a8a"],
		[19, 20, "#312e81"],
	] as const) {
		drawLaneBand(startLane, endLane, color);
	}
	context.strokeStyle = "#475569";
	context.lineWidth = 1;
	for (let lane = 0; lane <= 20; lane++) {
		context.beginPath();
		context.moveTo(laneX(lane, horizonY), horizonY);
		context.lineTo(laneX(lane, floorY), floorY);
		context.stroke();
	}
	context.strokeStyle = "#e2e8f0";
	context.lineWidth = 3;
	context.beginPath();
	context.moveTo(laneX(0, floorY) - 8, floorY);
	context.lineTo(laneX(20, floorY) + 8, floorY);
	context.stroke();

	const approachBeats = 8;
	const yAtBeat = (beat: number) => {
		const depth = 1 - (beat - currentBeat) / approachBeats;
		return horizonY + depth ** 1.7 * (floorY - horizonY);
	};
	for (const note of chart.notes) {
		const notePosition = positionValue(note.position);
		const distance = notePosition - currentBeat;
		const sustainEnd = "end" in note.kind ? positionValue(note.kind.end) : null;
		const visibleEnd = sustainEnd ?? notePosition;
		if (visibleEnd < currentBeat - 1 || distance > approachBeats) continue;
		const [startLane, endLane] = laneRange(note.lane);
		const headIsVisible = distance >= -1;
		const headY = Math.max(horizonY, Math.min(floorY, yAtBeat(notePosition)));
		const headWidth = Math.max(
			4,
			laneX(endLane, headY) - laneX(startLane, headY) - 4,
		);
		if (sustainEnd !== null && visibleEnd > notePosition) {
			const sustainStartY = Math.max(
				horizonY,
				Math.min(floorY, yAtBeat(Math.max(notePosition, currentBeat - 1))),
			);
			const sustainEndY = Math.max(
				horizonY,
				Math.min(
					floorY,
					yAtBeat(Math.min(visibleEnd, currentBeat + approachBeats)),
				),
			);
			const sustainWidthAt = (y: number) =>
				Math.max(4, laneX(endLane, y) - laneX(startLane, y) - 4) * 0.38;
			const startCenter =
				(laneX(startLane, sustainStartY) + laneX(endLane, sustainStartY)) / 2;
			const endCenter =
				(laneX(startLane, sustainEndY) + laneX(endLane, sustainEndY)) / 2;
			context.fillStyle = noteColor(note);
			context.globalAlpha = 0.58;
			context.beginPath();
			context.moveTo(
				startCenter - sustainWidthAt(sustainStartY) / 2,
				sustainStartY,
			);
			context.lineTo(
				startCenter + sustainWidthAt(sustainStartY) / 2,
				sustainStartY,
			);
			context.lineTo(endCenter + sustainWidthAt(sustainEndY) / 2, sustainEndY);
			context.lineTo(endCenter - sustainWidthAt(sustainEndY) / 2, sustainEndY);
			context.closePath();
			context.fill();
			context.globalAlpha = 1;
		}
		if (!headIsVisible || headY >= floorY || headY < horizonY) continue;
		const perspective = (headY - horizonY) / (floorY - horizonY);
		const points = pathPoints(note);
		if (points.length > 1) {
			context.strokeStyle = noteColor(note);
			context.lineWidth = 3 + perspective * 5;
			context.beginPath();
			[
				{ position: positionValue(note.position), lane: note.lane },
				...points,
			].forEach((point, index) => {
				const pointDistance = point.position - currentBeat;
				if (pointDistance < -1 || pointDistance > approachBeats) return;
				const pointDepth = 1 - pointDistance / approachBeats;
				const pointY = horizonY + pointDepth ** 1.7 * (floorY - horizonY);
				const [pointStart, pointEnd] = laneRange(point.lane);
				const pointX = laneX((pointStart + pointEnd) / 2, pointY);
				if (index === 0) context.moveTo(pointX, pointY);
				else context.lineTo(pointX, pointY);
			});
			context.stroke();
		}
		const gameX = laneX(startLane, headY) + 2;
		const gameWidth = headWidth;
		context.fillStyle = noteColor(note);
		context.fillRect(
			gameX,
			headY - 5 - perspective * 4,
			gameWidth,
			7 + perspective * 8,
		);
	}
}

export function ChartRenderer({
	chart,
	position,
	onPositionChange,
}: {
	chart: ChartData;
	position?: number;
	onPositionChange?: (position: number) => void;
}) {
	const sheet = useRef<HTMLCanvasElement>(null);
	const playfield = useRef<HTMLCanvasElement>(null);
	const programmaticScrollTop = useRef<number | undefined>(undefined);
	const [localPosition, setLocalPosition] = useState(0);
	const currentBeat = position ?? localPosition;
	const end = chartEnd(chart);

	useEffect(() => {
		const draw = () => {
			if (sheet.current) paintSheet(sheet.current, chart, currentBeat);
			if (playfield.current)
				paintPlayfield(playfield.current, chart, currentBeat);
		};
		draw();
		const observer = new ResizeObserver(draw);
		if (sheet.current) observer.observe(sheet.current);
		if (playfield.current) observer.observe(playfield.current);
		return () => observer.disconnect();
	}, [chart, currentBeat]);
	useEffect(() => {
		if (position === undefined) return;
		setLocalPosition(position);
		const canvas = sheet.current;
		const viewport = canvas?.parentElement;
		if (!canvas || !viewport) return;
		const contentHeight = canvas.clientHeight - viewport.clientHeight;
		const scrollTop = Math.max(0, (position / end) * contentHeight);
		if (Math.abs(viewport.scrollTop - scrollTop) > 2) {
			programmaticScrollTop.current = scrollTop;
			viewport.scrollTop = scrollTop;
		}
	}, [position, end]);

	function changePosition(beat: number) {
		setLocalPosition(beat);
		onPositionChange?.(beat);
	}

	function seekTo(beat: number) {
		const canvas = sheet.current;
		const viewport = canvas?.parentElement;
		if (canvas && viewport) {
			const contentHeight = canvas.clientHeight - viewport.clientHeight;
			viewport.scrollTop = Math.max(0, (beat / end) * contentHeight);
		}
		changePosition(beat);
	}

	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
			<section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-4">
				<h2 className="mb-3 text-sm font-semibold text-white">譜面シート</h2>
				<div
					className="relative max-h-[70vh] overflow-y-auto rounded-lg"
					onScroll={(event) => {
						const viewport = event.currentTarget;
						const canvas = sheet.current;
						if (!canvas) return;
						const contentHeight = canvas.clientHeight - viewport.clientHeight;
						const expectedScrollTop = programmaticScrollTop.current;
						programmaticScrollTop.current = undefined;
						if (
							expectedScrollTop !== undefined &&
							Math.abs(viewport.scrollTop - expectedScrollTop) <= 2
						) {
							return;
						}
						const beat = (viewport.scrollTop / contentHeight) * end;
						changePosition(Math.max(0, Math.min(end, beat)));
					}}
				>
					<canvas
						aria-label="譜面全体"
						className="block w-full"
						ref={sheet}
						style={{ height: `calc(${Math.max(1800, end * 80)}px + 70vh)` }}
					/>
					<div className="pointer-events-none sticky bottom-[18%] h-0 border-t-2 border-rose-400 shadow-[0_0_12px_#fb7185]" />
				</div>
				<label className="mt-4 block text-xs text-slate-300">
					<span className="mb-2 flex justify-between">
						<span>再生位置</span>
						<span>{currentBeat.toFixed(2)} 拍</span>
					</span>
					<input
						aria-label="再生位置"
						className="w-full accent-rose-400"
						max={end}
						min={0}
						onChange={(event) => seekTo(Number(event.target.value))}
						step={0.01}
						type="range"
						value={currentBeat}
					/>
				</label>
			</section>
			<section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-4">
				<h2 className="mb-3 text-sm font-semibold text-white">
					ゲーム画面（簡易表示）
				</h2>
				<canvas
					aria-label="簡易ゲーム画面"
					className="block aspect-[4/5] w-full"
					ref={playfield}
				/>
			</section>
		</div>
	);
}
