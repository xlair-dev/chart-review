"use client";

import { useEffect, useRef } from "react";
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
		[19, 20],
		[18, 19],
		[1, 2],
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
		...chart.notes.map((note) => positionValue(note.position)),
	);
}

function paintSheet(canvas: HTMLCanvasElement, chart: ChartData) {
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
	const top = 30;
	const bottom = height - 30;
	const laneWidth = (right - left) / laneCount;
	const end = chartEnd(chart);

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
		const y = bottom - (beat / end) * (bottom - top);
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
		const y = bottom - (positionValue(note.position) / end) * (bottom - top);
		const endPosition =
			"end" in note.kind ? positionValue(note.kind.end) : undefined;
		context.fillStyle = noteColor(note);
		if (endPosition !== undefined) {
			const endY = bottom - (endPosition / end) * (bottom - top);
			context.globalAlpha = 0.45;
			context.fillRect(x + noteWidth * 0.35, y, noteWidth * 0.3, endY - y);
			context.globalAlpha = 1;
		}
		context.beginPath();
		context.roundRect(x, y - 5, noteWidth, 10, 4);
		context.fill();
	}
}

function paintPlayfield(canvas: HTMLCanvasElement, chart: ChartData) {
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
	const horizonWidth = width * 0.3;
	const floorWidth = width * 0.9;
	const center = width / 2;
	context.fillStyle = "#172554";
	context.beginPath();
	context.moveTo(center - horizonWidth / 2, horizonY);
	context.lineTo(center + horizonWidth / 2, horizonY);
	context.lineTo(center + floorWidth / 2, height * 0.86);
	context.lineTo(center - floorWidth / 2, height * 0.86);
	context.closePath();
	context.fill();
	context.strokeStyle = "#475569";
	context.lineWidth = 1;
	for (let lane = 0; lane <= 16; lane++) {
		const topX = center - horizonWidth / 2 + (horizonWidth * lane) / 16;
		const bottomX = center - floorWidth / 2 + (floorWidth * lane) / 16;
		context.beginPath();
		context.moveTo(topX, horizonY);
		context.lineTo(bottomX, height * 0.86);
		context.stroke();
	}
	context.strokeStyle = "#e2e8f0";
	context.lineWidth = 3;
	context.beginPath();
	context.moveTo(center - floorWidth / 2 - 12, height * 0.86);
	context.lineTo(center + floorWidth / 2 + 12, height * 0.86);
	context.stroke();

	const end = chartEnd(chart);
	for (const note of chart.notes) {
		const progress = positionValue(note.position) / end;
		const depth = 1 - progress;
		const y = horizonY + depth ** 1.7 * (height * 0.62);
		if (y > height * 0.86 || y < horizonY) continue;
		const [startLane, endLane] = laneRange(note.lane);
		const perspective = y / height;
		const gameWidth =
			floorWidth *
			(startLane === 0 || endLane === 20
				? 0.04
				: 0.05 + (endLane - startLane) * 0.018) *
			perspective;
		const gameX =
			center +
			(((startLane + endLane) / 2 - 10) / 16) * floorWidth * perspective -
			gameWidth / 2;
		context.fillStyle = noteColor(note);
		context.fillRect(
			gameX,
			y - 5 - perspective * 4,
			gameWidth,
			7 + perspective * 8,
		);
	}
}

export function ChartRenderer({ chart }: { chart: ChartData }) {
	const sheet = useRef<HTMLCanvasElement>(null);
	const playfield = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const draw = () => {
			if (sheet.current) paintSheet(sheet.current, chart);
			if (playfield.current) paintPlayfield(playfield.current, chart);
		};
		draw();
		const observer = new ResizeObserver(draw);
		if (sheet.current) observer.observe(sheet.current);
		if (playfield.current) observer.observe(playfield.current);
		return () => observer.disconnect();
	}, [chart]);

	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
			<section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-4">
				<h2 className="mb-3 text-sm font-semibold text-white">譜面シート</h2>
				<div className="relative max-h-[70vh] overflow-y-auto rounded-lg">
					<canvas
						aria-label="譜面全体"
						className="block w-full"
						ref={sheet}
						style={{ height: `${Math.max(1800, chartEnd(chart) * 80)}px` }}
					/>
					<div className="pointer-events-none sticky bottom-[18%] h-0 border-t-2 border-rose-400 shadow-[0_0_12px_#fb7185]" />
				</div>
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
