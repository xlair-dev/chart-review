"use client";

import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { ChartData, Lane, Note, SideButton } from "@/lib/chart-model";
import { sideXTapPairs } from "@/lib/chart-note-relations";
import { positionValue } from "@/lib/chart-position";

const sideOrder = [
	"leftUpper",
	"leftLower",
	"rightLower",
	"rightUpper",
] as const;
const laneCount = 20;
const sheetPixelsPerBeat = 100;
const sheetCursorRatio = 0.82;
const playfieldLookBehindBeats = 1;
const sheetTileHeight = 16_000;
const playfieldSideWidthScale = 1.2;
const playfieldUpperRiseScale = 2.2;
const holdColor = "#34d399";
/** The approach window represents a finite depth range in the perspective projection. */
const playfieldFarDistance = 4;

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
	displayNameField: ReactNode;
	onBodyChange: (body: string) => void;
	onSubmit: () => void;
	onCancel: () => void;
}

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
	if (note.kind.type === "tap") {
		if (note.kind.tap.type === "xTap") return "#fbbf24";
		if (note.kind.tap.type === "flick") return "#c084fc";
		if (note.lane.type === "side" && note.kind.tap.type === "tap") {
			return holdColor;
		}
	}
	switch (note.kind.type) {
		case "mine":
			return "#fb7185";
		case "hold":
		case "exHold":
		case "airHold":
			return holdColor;
		case "slide":
		case "exSlide":
			return "#38bdf8";
		case "airSlide":
		case "airCrush":
			return "#c084fc";
		case "exTap":
			return "#fbbf24";
		default:
			return "#38bdf8";
	}
}

function colorWithAlpha(color: string, alpha: number): string {
	const value = color.slice(1);
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function canvasScale(width: number, height: number): number {
	const devicePixelRatio = window.devicePixelRatio || 1;
	const maxCanvasArea = 128_000_000;
	const maxCanvasDimension = 32_767;
	return Math.min(
		devicePixelRatio,
		maxCanvasDimension / width,
		maxCanvasDimension / height,
		Math.sqrt(maxCanvasArea / (width * height)),
	);
}

function sheetPositionStyle(position: number, end: number): string {
	const ratio = 1 - position / end;
	return `calc(${ratio * 100}% + ${36 - ratio * 60}px)`;
}

function sheetLaneStyle(lane: number): string {
	const ratio = lane / 20;
	return `calc(${ratio * 100}% + ${34 - ratio * 52}px)`;
}

function paintNoteHead(
	context: CanvasRenderingContext2D,
	note: Note,
	x: number,
	y: number,
	width: number,
	height: number,
	angle?: number,
) {
	const color = noteColor(note);
	if (angle !== undefined) {
		context.save();
		context.translate(x + width / 2, y);
		context.rotate(angle);
		x = -width / 2;
		y = 0;
	}
	const isHoldHead =
		note.kind.type === "hold" ||
		note.kind.type === "exHold" ||
		note.kind.type === "airHold";
	if (!isHoldHead) {
		context.fillStyle = color;
		context.beginPath();
		context.roundRect(x, y - height / 2, width, height, height * 0.4);
		context.fill();
		if (angle !== undefined) context.restore();
		return;
	}
	context.fillStyle = colorWithAlpha(color, 0.24);
	context.beginPath();
	context.roundRect(x, y - height / 2, width, height, height * 0.4);
	context.fill();
	context.strokeStyle = colorWithAlpha(color, 0.72);
	context.lineWidth = Math.max(1.5, height * 0.24);
	context.lineCap = "round";
	context.beginPath();
	context.moveTo(x + Math.min(2, width / 4), y);
	context.lineTo(x + width - Math.min(2, width / 4), y);
	context.stroke();
	if (angle !== undefined) context.restore();
}

type RawPathPoint = {
	position: number;
	lane: Lane;
	kind: "visible" | "control" | "invisible";
};

function pathPoints(note: Note): RawPathPoint[] {
	if (note.kind.type === "slide" || note.kind.type === "exSlide") {
		return note.kind.points.map((point) => ({
			position: positionValue(point.position),
			lane: point.lane,
			kind: point.kind,
		}));
	}
	if (note.kind.type === "airSlide" || note.kind.type === "airCrush") {
		return note.kind.points.map((point) => ({
			position: positionValue(point.position),
			lane: point.lane,
			kind: point.kind,
		}));
	}
	return [];
}

/** Draws the converter-provided points as authored; resampling control points changes the path. */
function renderedPathPoints(
	note: Note,
	path: RawPathPoint[] = pathPoints(note),
): RawPathPoint[] {
	if (path.length === 0) return [];
	return [
		{
			position: positionValue(note.position),
			lane: note.lane,
			kind: "visible",
		},
		...path,
	];
}

interface PlayfieldPathPoint {
	position: number;
	laneStart: number;
	laneEnd: number;
}

function playfieldPathPoints(
	source: RawPathPoint[],
	currentBeat: number,
	approachBeats: number,
): PlayfieldPathPoint[] {
	if (source.length < 2) return [];

	// A slider must be clipped at the judgment line, not at its original start lane.
	const minimum = currentBeat;
	const maximum = currentBeat + approachBeats;
	const from = Math.max(minimum, source[0].position);
	const to = Math.min(maximum, source.at(-1)?.position ?? from);
	if (to <= from) return [];

	const pointAt = (position: number): PlayfieldPathPoint => {
		for (let index = 1; index < source.length; index += 1) {
			const start = source[index - 1];
			const finish = source[index];
			if (finish.position < position || finish.position <= start.position) {
				continue;
			}
			const progress = Math.max(
				0,
				Math.min(
					1,
					(position - start.position) / (finish.position - start.position),
				),
			);
			const [startLane, startLaneEnd] = laneRange(start.lane);
			const [finishLane, finishLaneEnd] = laneRange(finish.lane);
			return {
				position,
				laneStart: startLane + (finishLane - startLane) * progress,
				laneEnd: startLaneEnd + (finishLaneEnd - startLaneEnd) * progress,
			};
		}
		const last = source.at(-1);
		if (!last) return { position, laneStart: 2, laneEnd: 18 };
		const [laneStart, laneEnd] = laneRange(last.lane);
		return { position, laneStart, laneEnd };
	};

	const result = [
		pointAt(from),
		...source
			.slice(1, -1)
			.filter((point) => point.position > from && point.position < to)
			.map((point) => {
				const [laneStart, laneEnd] = laneRange(point.lane);
				return { ...point, laneStart, laneEnd };
			}),
		pointAt(to),
	];
	return result;
}

function isTapHead(note: Note): boolean {
	return note.kind.type === "tap" || note.kind.type === "exTap";
}

function isSideHold(note: Note): boolean {
	return (
		note.lane.type === "side" &&
		(note.kind.type === "hold" ||
			note.kind.type === "exHold" ||
			note.kind.type === "airHold")
	);
}

function measureBoundaries(chart: ChartData, end: number): number[] {
	const measures = [...chart.measureLengths].sort(
		(left, right) => left.measure - right.measure,
	);
	if (measures.length === 0) {
		return Array.from(
			{ length: Math.ceil(end / 4) + 1 },
			(_, index) => index * 4,
		);
	}

	const boundaries: number[] = [];
	let duration = 4;
	let measure = 0;
	let beat = 0;
	let lengthIndex = 0;
	while (beat <= end + duration) {
		while (
			lengthIndex < measures.length &&
			measures[lengthIndex].measure <= measure
		) {
			duration = Math.max(0.01, positionValue(measures[lengthIndex].length));
			lengthIndex += 1;
		}
		boundaries.push(beat);
		beat += duration;
		measure += 1;
	}
	return boundaries;
}

interface PreparedNote {
	index: number;
	note: Note;
	position: number;
	endPosition: number;
	sustainEnd: number | null;
	laneStart: number;
	laneEnd: number;
	path: RawPathPoint[];
	playfieldPath: RawPathPoint[];
	checkpoints: RawPathPoint[];
}

interface ChartRenderData {
	end: number;
	measureBoundaries: number[];
	spatialIndex: PreparedNote[];
	spatialIndexTree: number[];
	spatialIndexSize: number;
}

/** Parsed chart data is immutable while rendered, so derived geometry stays valid for this cache entry. */
const chartRenderDataCache = new WeakMap<ChartData, ChartRenderData>();

function notesForRendering(chart: ChartData): Note[] {
	const sideButtonsByParent = new Map<number, Set<SideButton>>();
	const sideXTapAirNoteIds = new Set<number>();
	for (const relation of sideXTapPairs(chart)) {
		const buttons = sideButtonsByParent.get(relation.parentId) ?? new Set();
		buttons.add(relation.button);
		sideButtonsByParent.set(relation.parentId, buttons);
		sideXTapAirNoteIds.add(relation.airNoteId);
	}

	return chart.notes.flatMap((note) => {
		const sideButtons = sideButtonsByParent.get(note.id);
		if (sideButtons) {
			return [...sideButtons].map((button) => ({
				...note,
				lane: { type: "side" as const, button },
			}));
		}
		return sideXTapAirNoteIds.has(note.id) ? [] : [note];
	});
}

function renderDataFor(chart: ChartData): ChartRenderData {
	const cached = chartRenderDataCache.get(chart);
	if (cached) return cached;

	let end = 4;
	const notes = notesForRendering(chart).map((note, index): PreparedNote => {
		const position = positionValue(note.position);
		const rawPath = pathPoints(note);
		let endPosition = position;
		for (const point of rawPath) {
			endPosition = Math.max(endPosition, point.position);
		}
		if ("end" in note.kind) {
			endPosition = Math.max(endPosition, positionValue(note.kind.end));
		}
		const sustainEnd = "end" in note.kind ? positionValue(note.kind.end) : null;
		const holdCheckpoints =
			note.kind.type === "hold" ||
			note.kind.type === "exHold" ||
			note.kind.type === "airHold"
				? note.kind.checkpoints.map((checkpoint) => ({
						position: positionValue(checkpoint),
						lane: note.lane,
						kind: "visible" as const,
					}))
				: [];
		end = Math.max(end, endPosition);
		const path = renderedPathPoints(note, rawPath);
		const [laneStart, laneEnd] = laneRange(note.lane);
		return {
			index,
			note,
			position,
			endPosition,
			sustainEnd,
			laneStart,
			laneEnd,
			path,
			checkpoints: [
				...rawPath.filter(
					(point) => point.kind === "visible" && point.position > position,
				),
				...holdCheckpoints,
			],
			playfieldPath: path.filter(
				(point, pointIndex, points) =>
					pointIndex === 0 || point.position >= points[pointIndex - 1].position,
			),
		};
	});
	const spatialIndex = [...notes].sort(
		(left, right) => left.position - right.position || left.index - right.index,
	);
	let spatialIndexSize = 1;
	while (spatialIndexSize < spatialIndex.length) spatialIndexSize *= 2;
	const spatialIndexTree = Array(spatialIndexSize * 2).fill(
		Number.NEGATIVE_INFINITY,
	);
	for (let index = 0; index < spatialIndex.length; index += 1) {
		spatialIndexTree[spatialIndexSize + index] =
			spatialIndex[index].endPosition;
	}
	for (let index = spatialIndexSize - 1; index > 0; index -= 1) {
		spatialIndexTree[index] = Math.max(
			spatialIndexTree[index * 2],
			spatialIndexTree[index * 2 + 1],
		);
	}
	const data: ChartRenderData = {
		end,
		measureBoundaries: measureBoundaries(chart, end),
		spatialIndex,
		spatialIndexTree,
		spatialIndexSize,
	};
	chartRenderDataCache.set(chart, data);
	return data;
}

function notesOverlapping(
	data: ChartRenderData,
	minimum: number,
	maximum: number,
): PreparedNote[] {
	let limit = 0;
	let high = data.spatialIndex.length;
	while (limit < high) {
		const middle = (limit + high) >>> 1;
		if (data.spatialIndex[middle].position <= maximum) limit = middle + 1;
		else high = middle;
	}

	const visible: PreparedNote[] = [];
	const visit = (node: number, start: number, finish: number) => {
		if (start >= limit || data.spatialIndexTree[node] < minimum) return;
		if (finish - start === 1) {
			const note = data.spatialIndex[start];
			if (note) visible.push(note);
			return;
		}
		const middle = (start + finish) >>> 1;
		visit(node * 2, start, middle);
		visit(node * 2 + 1, middle, finish);
	};
	if (data.spatialIndex.length > 0) {
		visit(1, 0, data.spatialIndexSize);
	}
	return visible.sort((left, right) => left.index - right.index);
}

function paintSheet(
	canvas: HTMLCanvasElement,
	data: ChartRenderData,
	displayEnd: number,
	sheetHeight: number,
	tileTop: number,
) {
	const context = canvas.getContext("2d");
	if (!context) return;
	const width = canvas.clientWidth;
	const tileHeight = canvas.clientHeight;
	if (width <= 0 || tileHeight <= 0 || sheetHeight <= 0) return;
	const ratio = canvasScale(width, tileHeight);
	canvas.width = Math.max(1, Math.floor(width * ratio));
	canvas.height = Math.max(1, Math.floor(tileHeight * ratio));
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.translate(0, -tileTop);
	context.fillStyle = "#0f172a";
	context.fillRect(0, tileTop, width, tileHeight);
	const left = 34;
	const right = width - 18;
	const top = 36;
	const end = displayEnd;
	const bottom = sheetHeight - 24;
	const laneWidth = (right - left) / laneCount;
	const beatPerPixel = end / (bottom - top);
	const tileTopBeat = ((bottom - tileTop) / (bottom - top)) * end;
	const tileBottomBeat =
		((bottom - tileTop - tileHeight) / (bottom - top)) * end;

	for (let lane = 0; lane <= laneCount; lane++) {
		const x = left + lane * laneWidth;
		context.strokeStyle = lane === 2 || lane === 18 ? "#64748b" : "#334155";
		context.lineWidth = lane === 2 || lane === 18 ? 1.5 : 1;
		context.beginPath();
		context.moveTo(x, top);
		context.lineTo(x, bottom);
		context.stroke();
	}
	for (
		let beat = Math.max(0, Math.ceil(tileBottomBeat - 2 * beatPerPixel));
		beat <= Math.min(end, tileTopBeat + 2 * beatPerPixel);
		beat++
	) {
		const y = bottom - (beat / end) * (bottom - top);
		context.strokeStyle = beat % 4 === 0 ? "#475569" : "#1e293b";
		context.beginPath();
		context.moveTo(left, y);
		context.lineTo(right, y);
		context.stroke();
	}

	const beatPadding = 12 * beatPerPixel;
	const minimum = Math.max(0, tileBottomBeat - beatPadding);
	const maximum = Math.min(displayEnd, tileTopBeat + beatPadding);
	const notes = notesOverlapping(data, minimum, maximum).sort(
		(left, right) =>
			Number(isTapHead(left.note)) - Number(isTapHead(right.note)) ||
			left.index - right.index,
	);
	for (const prepared of notes) {
		const { note, position, laneStart: startLane, laneEnd: endLane } = prepared;
		const color = noteColor(note);
		const x = left + startLane * laneWidth + 2;
		const noteWidth = Math.max(4, (endLane - startLane) * laneWidth - 4);
		const y = bottom - (position / end) * (bottom - top);
		const endPosition =
			"end" in note.kind ? positionValue(note.kind.end) : undefined;
		context.fillStyle = noteColor(note);
		const points = prepared.path;
		if (points.length > 1) {
			context.lineCap = "round";
			context.lineJoin = "round";
			for (let index = 1; index < points.length; index += 1) {
				const previous = points[index - 1];
				const point = points[index];
				const [previousStart, previousEnd] = laneRange(previous.lane);
				const [pointStart, pointEnd] = laneRange(point.lane);
				const previousY = bottom - (previous.position / end) * (bottom - top);
				const pointY = bottom - (point.position / end) * (bottom - top);
				const previousLeft = left + previousStart * laneWidth;
				const previousRight = left + previousEnd * laneWidth;
				const pointLeft = left + pointStart * laneWidth;
				const pointRight = left + pointEnd * laneWidth;
				context.fillStyle = colorWithAlpha(color, 0.22);
				context.beginPath();
				context.moveTo(previousLeft, previousY);
				context.lineTo(previousRight, previousY);
				context.lineTo(pointRight, pointY);
				context.lineTo(pointLeft, pointY);
				context.closePath();
				context.fill();
				context.strokeStyle = colorWithAlpha(color, 0.7);
				context.lineWidth = 2.5;
				context.beginPath();
				context.moveTo((previousLeft + previousRight) / 2, previousY);
				context.lineTo((pointLeft + pointRight) / 2, pointY);
				context.stroke();
			}
		}
		for (const checkpoint of prepared.checkpoints) {
			if (checkpoint.position < minimum || checkpoint.position > maximum)
				continue;
			const [checkpointStart, checkpointEnd] = laneRange(checkpoint.lane);
			const checkpointY = bottom - (checkpoint.position / end) * (bottom - top);
			context.strokeStyle = color;
			context.lineWidth = 3;
			context.beginPath();
			context.moveTo(left + checkpointStart * laneWidth, checkpointY);
			context.lineTo(left + checkpointEnd * laneWidth, checkpointY);
			context.stroke();
		}
		if (endPosition !== undefined) {
			const endY = bottom - (endPosition / end) * (bottom - top);
			context.globalAlpha = 0.45;
			context.fillRect(x, Math.min(y, endY), noteWidth, Math.abs(endY - y));
			context.globalAlpha = 1;
			if (isSideHold(note)) {
				context.strokeStyle = colorWithAlpha(color, 0.7);
				context.lineWidth = 2.5;
				context.beginPath();
				context.moveTo(x + noteWidth / 2, y);
				context.lineTo(x + noteWidth / 2, endY);
				context.stroke();
			}
		}
		paintNoteHead(context, note, x, y, noteWidth, 10);
	}
}

function paintPlayfield(
	canvas: HTMLCanvasElement,
	data: ChartRenderData,
	currentBeat: number,
	noteSpeed: number,
) {
	const context = canvas.getContext("2d");
	if (!context) return;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if (width <= 0 || height <= 0) return;
	const ratio = window.devicePixelRatio || 1;
	canvas.width = width * ratio;
	canvas.height = height * ratio;
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
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
	const lanePoint = (lane: number, y: number): [number, number] => {
		const lowerWidth =
			Math.abs(baseLaneX(2, y) - baseLaneX(1, y)) * playfieldSideWidthScale;
		const lowerRise = lowerWidth * Math.tan(Math.PI / 4);
		const upperRise = lowerWidth * playfieldUpperRiseScale;
		if (lane === 1) return [baseLaneX(2, y) - lowerWidth, y - lowerRise];
		if (lane === 0)
			return [baseLaneX(2, y) - lowerWidth, y - lowerRise - upperRise];
		if (lane === 19) return [baseLaneX(18, y) + lowerWidth, y - lowerRise];
		if (lane === 20)
			return [baseLaneX(18, y) + lowerWidth, y - lowerRise - upperRise];
		return [baseLaneX(lane, y), y];
	};
	const renderedLanePointAtDepth = (
		lane: number,
		depth: number,
	): [number, number] => {
		const progress = clamp(depth, 0, 1);
		const [topX, topY] = lanePoint(lane, horizonY);
		const [bottomX, bottomY] = lanePoint(lane, floorY);
		return [
			topX + (bottomX - topX) * progress,
			topY + (bottomY - topY) * progress,
		];
	};
	const drawLaneSurface = (
		startLane: number,
		endLane: number,
		color: string,
	) => {
		const [startTopX, startTopY] = lanePoint(startLane, horizonY);
		const [endTopX, endTopY] = lanePoint(endLane, horizonY);
		const [endBottomX, endBottomY] = lanePoint(endLane, floorY);
		const [startBottomX, startBottomY] = lanePoint(startLane, floorY);
		context.fillStyle = color;
		context.beginPath();
		context.moveTo(startTopX, startTopY);
		context.lineTo(endTopX, endTopY);
		context.lineTo(endBottomX, endBottomY);
		context.lineTo(startBottomX, startBottomY);
		context.closePath();
		context.fill();
	};
	drawLaneSurface(2, 18, "#172554");
	drawLaneSurface(1, 2, "#1e3a8a");
	drawLaneSurface(0, 1, "#312e81");
	drawLaneSurface(18, 19, "#1e3a8a");
	drawLaneSurface(19, 20, "#312e81");
	context.strokeStyle = "#475569";
	context.lineWidth = 1;
	for (let lane = 0; lane <= 20; lane++) {
		const [topX, topY] = lanePoint(lane, horizonY);
		const [bottomX, bottomY] = lanePoint(lane, floorY);
		context.beginPath();
		context.moveTo(topX, topY);
		context.lineTo(bottomX, bottomY);
		context.stroke();
	}
	context.strokeStyle = "#e2e8f0";
	context.lineWidth = 3;
	context.beginPath();
	for (let lane = 0; lane <= 20; lane++) {
		const [x, y] = lanePoint(lane, floorY);
		if (lane === 0) context.moveTo(x, y);
		else context.lineTo(x, y);
	}
	context.stroke();

	const approachBeats = 6 / noteSpeed;
	const perspectiveDepth = (beat: number) => {
		const normalizedDistance = clamp(
			1 - (beat - currentBeat) / approachBeats,
			0,
			1,
		);
		return (
			normalizedDistance /
			(playfieldFarDistance - (playfieldFarDistance - 1) * normalizedDistance)
		);
	};
	const yAtBeat = (beat: number) => {
		const depth = perspectiveDepth(beat);
		return horizonY + depth * (floorY - horizonY);
	};
	context.strokeStyle = "#334155";
	context.lineWidth = 1;
	let measureIndex = 0;
	let measureHigh = data.measureBoundaries.length;
	const firstVisibleMeasure = currentBeat - playfieldLookBehindBeats;
	while (measureIndex < measureHigh) {
		const middle = (measureIndex + measureHigh) >>> 1;
		if (data.measureBoundaries[middle] < firstVisibleMeasure) {
			measureIndex = middle + 1;
		} else {
			measureHigh = middle;
		}
	}
	for (
		let index = measureIndex;
		index < data.measureBoundaries.length &&
		data.measureBoundaries[index] <= currentBeat + approachBeats;
		index++
	) {
		const beat = data.measureBoundaries[index];
		const y = Math.max(horizonY, Math.min(floorY, yAtBeat(beat)));
		context.beginPath();
		for (let lane = 0; lane <= 20; lane++) {
			const [x, laneY] = lanePoint(lane, y);
			if (lane === 0) context.moveTo(x, laneY);
			else context.lineTo(x, laneY);
		}
		context.stroke();
	}
	const drawPath = (note: Note, path: PlayfieldPathPoint[]) => {
		if (path.length < 2) return;
		const color = noteColor(note);
		context.lineCap = "round";
		context.lineJoin = "round";
		for (let index = 1; index < path.length; index += 1) {
			const previous = path[index - 1];
			const point = path[index];
			const previousDepth = perspectiveDepth(previous.position);
			const pointDepth = perspectiveDepth(point.position);
			const [previousLeft, previousYOnLane] = renderedLanePointAtDepth(
				previous.laneStart,
				previousDepth,
			);
			const [previousRight, previousYOnLaneEnd] = renderedLanePointAtDepth(
				previous.laneEnd,
				previousDepth,
			);
			const [pointLeft, pointYOnLane] = renderedLanePointAtDepth(
				point.laneStart,
				pointDepth,
			);
			const [pointRight, pointYOnLaneEnd] = renderedLanePointAtDepth(
				point.laneEnd,
				pointDepth,
			);
			const previousCenter = (previousLeft + previousRight) / 2;
			const pointCenter = (pointLeft + pointRight) / 2;
			context.fillStyle = colorWithAlpha(color, 0.22);
			context.beginPath();
			context.moveTo(previousLeft, previousYOnLane);
			context.lineTo(previousRight, previousYOnLaneEnd);
			context.lineTo(pointRight, pointYOnLaneEnd);
			context.lineTo(pointLeft, pointYOnLane);
			context.closePath();
			context.fill();
			context.strokeStyle = colorWithAlpha(color, 0.7);
			context.lineWidth = 2.5;
			context.beginPath();
			context.moveTo(
				previousCenter,
				(previousYOnLane + previousYOnLaneEnd) / 2,
			);
			context.lineTo(pointCenter, (pointYOnLane + pointYOnLaneEnd) / 2);
			context.stroke();
		}
	};
	const visibleNotes = notesOverlapping(
		data,
		currentBeat - playfieldLookBehindBeats,
		currentBeat + approachBeats,
	).map((prepared) => ({
		prepared,
		path: playfieldPathPoints(
			prepared.playfieldPath,
			currentBeat,
			approachBeats,
		),
	}));
	for (const { prepared, path } of visibleNotes) {
		drawPath(prepared.note, path);
	}
	for (const { prepared } of visibleNotes) {
		const color = noteColor(prepared.note);
		for (const checkpoint of prepared.checkpoints) {
			if (
				checkpoint.position < currentBeat ||
				checkpoint.position > currentBeat + approachBeats
			) {
				continue;
			}
			const [laneStart, laneEnd] = laneRange(checkpoint.lane);
			const depth = perspectiveDepth(checkpoint.position);
			const [left, leftY] = renderedLanePointAtDepth(laneStart, depth);
			const [right, rightY] = renderedLanePointAtDepth(laneEnd, depth);
			context.strokeStyle = color;
			context.lineWidth = 2 + depth * 1.5;
			context.beginPath();
			context.moveTo(left, leftY);
			context.lineTo(right, rightY);
			context.stroke();
		}
	}
	for (const { prepared, path } of visibleNotes) {
		const { note, position: notePosition } = prepared;
		const distance = notePosition - currentBeat;
		const sustainEnd = prepared.sustainEnd;
		const visibleEnd = prepared.endPosition;
		const sustainStartVisible =
			sustainEnd === null
				? null
				: Math.max(notePosition, currentBeat - playfieldLookBehindBeats);
		const sustainEndVisible =
			sustainEnd === null
				? null
				: Math.min(sustainEnd, currentBeat + approachBeats);
		const isSustainVisible =
			sustainStartVisible !== null &&
			sustainEndVisible !== null &&
			sustainStartVisible <= sustainEndVisible;
		const isPathVisible =
			path.length > 1 &&
			notePosition <= currentBeat + approachBeats &&
			visibleEnd >= currentBeat;
		if (
			!isSustainVisible &&
			!isPathVisible &&
			(visibleEnd < currentBeat - playfieldLookBehindBeats ||
				distance > approachBeats)
		)
			continue;
		const { laneStart: startLane, laneEnd: endLane } = prepared;
		const headIsVisible = distance >= -1;
		const headY = Math.max(horizonY, Math.min(floorY, yAtBeat(notePosition)));
		const headDepth = perspectiveDepth(notePosition);
		const hasSideHoldCenterline = isSideHold(note);
		const [headLeft, headLeftY] = renderedLanePointAtDepth(
			startLane,
			headDepth,
		);
		const [headRight, headRightY] = renderedLanePointAtDepth(
			endLane,
			headDepth,
		);
		const headVectorX = headRight - headLeft;
		const headVectorY = headRightY - headLeftY;
		const headWidth = Math.max(4, Math.hypot(headVectorX, headVectorY) - 4);
		if (
			isSustainVisible &&
			sustainStartVisible !== null &&
			sustainEndVisible !== null
		) {
			context.fillStyle = noteColor(note);
			context.globalAlpha = 0.58;
			context.beginPath();
			const sustainSegments = Math.max(
				8,
				Math.ceil(Math.abs(sustainEndVisible - sustainStartVisible) / 2),
			);
			const sustainCenterline: [number, number][] = [];
			for (let segment = 0; segment < sustainSegments; segment += 1) {
				const startRatio = segment / sustainSegments;
				const endRatio = (segment + 1) / sustainSegments;
				const segmentStartDepth = perspectiveDepth(
					sustainStartVisible +
						(sustainEndVisible - sustainStartVisible) * startRatio,
				);
				const segmentEndDepth = perspectiveDepth(
					sustainStartVisible +
						(sustainEndVisible - sustainStartVisible) * endRatio,
				);
				const [segmentStartLeft, segmentStartLeftY] = renderedLanePointAtDepth(
					startLane,
					segmentStartDepth,
				);
				const [segmentStartRight, segmentStartRightY] =
					renderedLanePointAtDepth(endLane, segmentStartDepth);
				const [segmentEndLeft, segmentEndLeftY] = renderedLanePointAtDepth(
					startLane,
					segmentEndDepth,
				);
				const [segmentEndRight, segmentEndRightY] = renderedLanePointAtDepth(
					endLane,
					segmentEndDepth,
				);
				if (hasSideHoldCenterline) {
					if (segment === 0) {
						sustainCenterline.push([
							(segmentStartLeft + segmentStartRight) / 2,
							(segmentStartLeftY + segmentStartRightY) / 2,
						]);
					}
					sustainCenterline.push([
						(segmentEndLeft + segmentEndRight) / 2,
						(segmentEndLeftY + segmentEndRightY) / 2,
					]);
				}
				context.moveTo(segmentStartLeft, segmentStartLeftY);
				context.lineTo(segmentStartRight, segmentStartRightY);
				context.lineTo(segmentEndRight, segmentEndRightY);
				context.lineTo(segmentEndLeft, segmentEndLeftY);
				context.closePath();
			}
			context.fill();
			context.globalAlpha = 1;
			if (sustainCenterline.length > 1) {
				context.strokeStyle = colorWithAlpha(noteColor(note), 0.7);
				context.lineWidth = 2.5;
				context.beginPath();
				context.moveTo(...sustainCenterline[0]);
				for (const [x, y] of sustainCenterline.slice(1)) {
					context.lineTo(x, y);
				}
				context.stroke();
			}
		}
		if (!headIsVisible || headY >= floorY || headY < horizonY) continue;
		const gameX = (headLeft + headRight) / 2 - headWidth / 2;
		const gameY = (headLeftY + headRightY) / 2;
		const headAngle = Math.atan2(headVectorY, headVectorX);
		const headHeight = 4 + headDepth * 5;
		paintNoteHead(
			context,
			note,
			gameX,
			gameY,
			headWidth,
			headHeight,
			headAngle,
		);
	}
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
	const sheetTiles = useRef<Array<HTMLCanvasElement | null>>([]);
	const sheetContent = useRef<HTMLDivElement>(null);
	const sheetViewport = useRef<HTMLDivElement>(null);
	const playfield = useRef<HTMLCanvasElement>(null);
	const programmaticScrollTop = useRef<number | undefined>(undefined);
	const preserveScrollAfterClick = useRef(false);
	const preservedScrollTopAfterClick = useRef<number | undefined>(undefined);
	const [localPosition, setLocalPosition] = useState(0);
	const [sheetViewportHeight, setSheetViewportHeight] = useState(0);
	const [isCommentListOpen, setIsCommentListOpen] = useState(true);
	const currentBeat = position ?? localPosition;
	const renderData = renderDataFor(chart);
	const end = renderData.end;
	const sheetPaddingBeats = Math.max(
		4,
		Math.ceil(
			(sheetViewportHeight * sheetCursorRatio) /
				(sheetPixelsPerBeat * noteSpeed),
		) + 1,
	);
	const sheetEnd = end + sheetPaddingBeats;
	const sheetHeight =
		sheetEnd * sheetPixelsPerBeat * noteSpeed +
		Math.max(sheetViewportHeight, 600);
	const sheetTileCount = Math.max(1, Math.ceil(sheetHeight / sheetTileHeight));
	const currentBeatRef = useRef(currentBeat);
	currentBeatRef.current = currentBeat;

	useEffect(() => {
		const viewport = sheetViewport.current;
		if (!viewport) return;
		const updateViewportHeight = () =>
			setSheetViewportHeight(viewport.clientHeight);
		updateViewportHeight();
		const observer = new ResizeObserver(updateViewportHeight);
		observer.observe(viewport);
		return () => observer.disconnect();
	}, []);
	useEffect(() => {
		const draw = () => {
			const contentHeight = sheetContent.current?.clientHeight ?? sheetHeight;
			for (const [index, canvas] of sheetTiles.current.entries()) {
				if (!canvas) continue;
				paintSheet(
					canvas,
					renderData,
					sheetEnd,
					contentHeight,
					index * sheetTileHeight,
				);
			}
			if (playfield.current)
				paintPlayfield(
					playfield.current,
					renderData,
					currentBeatRef.current,
					noteSpeed,
				);
		};
		const frame = requestAnimationFrame(draw);
		const observer = new ResizeObserver(draw);
		if (sheetContent.current) observer.observe(sheetContent.current);
		if (playfield.current) observer.observe(playfield.current);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [renderData, noteSpeed, sheetEnd, sheetHeight]);
	useEffect(() => {
		if (playfield.current)
			paintPlayfield(playfield.current, renderData, currentBeat, noteSpeed);
	}, [renderData, currentBeat, noteSpeed]);
	useLayoutEffect(() => {
		if (position === undefined) return;
		if (preserveScrollAfterClick.current) {
			const viewport = sheetContent.current?.parentElement;
			const scrollTop = preservedScrollTopAfterClick.current;
			if (viewport && scrollTop !== undefined) {
				programmaticScrollTop.current = scrollTop;
				viewport.scrollTop = scrollTop;
			}
			preservedScrollTopAfterClick.current = undefined;
			preserveScrollAfterClick.current = false;
			return;
		}
		const content = sheetContent.current;
		const viewport = content?.parentElement;
		if (!content || !viewport) return;
		const contentHeight = content.clientHeight - viewport.clientHeight;
		const sheetTop = 36;
		const sheetBottom = content.clientHeight - 24;
		const cursorY = viewport.clientHeight * sheetCursorRatio;
		const positionY =
			sheetBottom - (position / sheetEnd) * (sheetBottom - sheetTop);
		const scrollTop = Math.max(0, Math.min(contentHeight, positionY - cursorY));
		if (Math.abs(viewport.scrollTop - scrollTop) > 2) {
			programmaticScrollTop.current = scrollTop;
			viewport.scrollTop = scrollTop;
		}
	}, [position, sheetEnd]);

	function changePosition(beat: number) {
		setLocalPosition(beat);
		onPositionChange?.(beat);
	}

	function handleSheetClick(event: React.MouseEvent<HTMLElement>) {
		event.preventDefault();
		const content = sheetContent.current;
		if (!content) return;
		const viewport = content.parentElement;
		const contentRect = content.getBoundingClientRect();
		const y = event.clientY - contentRect.top;
		const sheetTop = 36;
		const sheetBottom = content.clientHeight - 24;
		const beat = ((sheetBottom - y) / (sheetBottom - sheetTop)) * sheetEnd;
		const nextPosition = Math.max(0, Math.min(end, beat));
		const left = 34;
		const right = content.clientWidth - 18;
		const lanePosition = Math.max(
			0,
			Math.min(
				20,
				((event.clientX - contentRect.left - left) / (right - left)) * 20,
			),
		);
		if (onCommentPositionChange) {
			onCommentPositionChange(nextPosition, lanePosition);
			return;
		}
		preserveScrollAfterClick.current = true;
		preservedScrollTopAfterClick.current = viewport?.scrollTop;
		changePosition(nextPosition);
	}

	function handleSheetKeyDown(event: React.KeyboardEvent<HTMLElement>) {
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
		event.preventDefault();
		changePosition(
			Math.max(
				0,
				Math.min(end, currentBeat + (event.key === "ArrowUp" ? 1 : -1)),
			),
		);
	}

	function seekTo(beat: number) {
		const content = sheetContent.current;
		const viewport = content?.parentElement;
		if (content && viewport) {
			const contentHeight = content.clientHeight - viewport.clientHeight;
			const sheetTop = 36;
			const sheetBottom = content.clientHeight - 24;
			const cursorY = viewport.clientHeight * sheetCursorRatio;
			const positionY =
				sheetBottom - (beat / sheetEnd) * (sheetBottom - sheetTop);
			viewport.scrollTop = Math.max(
				0,
				Math.min(contentHeight, positionY - cursorY),
			);
		}
		changePosition(beat);
	}

	return (
		<div
			className={`grid gap-5 ${commentListEnabled ? (isCommentListOpen ? "xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)_minmax(16rem,0.7fr)]" : "xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)_2.5rem]") : "xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]"}`}
		>
			<section className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-4">
				<h2 className="mb-3 text-sm font-semibold text-white">譜面シート</h2>
				<div
					className="relative max-h-[70vh] overflow-y-auto rounded-lg"
					ref={sheetViewport}
					onScroll={(event) => {
						const viewport = event.currentTarget;
						const content = sheetContent.current;
						if (!content) return;
						const contentHeight = content.clientHeight - viewport.clientHeight;
						const expectedScrollTop = programmaticScrollTop.current;
						programmaticScrollTop.current = undefined;
						if (
							expectedScrollTop !== undefined &&
							Math.abs(viewport.scrollTop - expectedScrollTop) <= 2
						) {
							return;
						}
						if (contentHeight <= 0) return;
						const sheetTop = 36;
						const sheetBottom = content.clientHeight - 24;
						const cursorY = viewport.clientHeight * sheetCursorRatio;
						const positionY = viewport.scrollTop + cursorY;
						const beat =
							((sheetBottom - positionY) / (sheetBottom - sheetTop)) * sheetEnd;
						changePosition(Math.max(0, Math.min(end, beat)));
					}}
				>
					<div
						className="relative cursor-pointer"
						ref={sheetContent}
						onClick={handleSheetClick}
						onKeyDown={handleSheetKeyDown}
						role="application"
						style={{ height: `${sheetHeight}px` }}
					>
						{Array.from({ length: sheetTileCount }, (_, index) => {
							const tileTop = index * sheetTileHeight;
							const tileHeight = Math.min(
								sheetTileHeight,
								sheetHeight - tileTop,
							);
							return (
								<canvas
									aria-label={index === 0 ? "譜面全体" : undefined}
									className="block w-full"
									key={tileTop}
									ref={(canvas) => {
										sheetTiles.current[index] = canvas;
									}}
									style={{ height: `${tileHeight}px` }}
								/>
							);
						})}
						{commentComposer && (
							<div
								aria-hidden="true"
								className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-400 shadow-[0_0_0_3px_rgba(56,189,248,0.35)]"
								style={{
									left: sheetLaneStyle(commentComposer.lanePosition),
									top: sheetPositionStyle(commentComposer.position, sheetEnd),
								}}
							/>
						)}
						{!isPlaying &&
							comments.map((comment) => (
								<button
									className="absolute z-10 max-w-[min(18rem,70%)] -translate-y-1/2 rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2 text-left text-xs text-slate-800 shadow-lg backdrop-blur-sm transition hover:border-rose-300 hover:bg-rose-50/80"
									key={comment.id}
									type="button"
									onClick={(event) => {
										event.stopPropagation();
										onCommentDelete?.(comment);
									}}
									style={{
										top: sheetPositionStyle(comment.position, sheetEnd),
										left: sheetLaneStyle(comment.lanePosition),
										transform: "translate(-50%, -50%)",
									}}
								>
									<strong className="block text-sky-900">
										{comment.displayName}
									</strong>
									<span className="mt-1 block whitespace-pre-wrap leading-5">
										{comment.body}
									</span>
								</button>
							))}
					</div>
					<div className="pointer-events-none sticky bottom-[18%] h-0 border-t-2 border-rose-400 shadow-[0_0_12px_#fb7185]" />
				</div>
				{commentComposer && (
					<div className="absolute inset-x-4 bottom-4 z-20 rounded-xl border border-sky-200 bg-white/95 p-4 text-slate-900 shadow-xl backdrop-blur-sm">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="text-sm font-semibold">この位置にコメント</p>
								<p className="mt-1 text-xs text-slate-500">
									{commentComposer.position.toFixed(2)} 拍 ・ レーン{" "}
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
						<div className="mt-3">{commentComposer.displayNameField}</div>
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
				)}
				<div className="mt-4 flex items-end gap-4 text-xs text-slate-300">
					<label className="min-w-0 flex-1">
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
					{onNoteSpeedChange && (
						<label className="w-24 shrink-0">
							<span className="mb-2 block">ノーツ速度</span>
							<div className="flex items-center gap-1">
								<input
									aria-label="ノーツ速度"
									className="w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-right text-slate-100"
									max={2}
									min={0.5}
									onChange={(event) => {
										onNoteSpeedChange(event.target.value);
									}}
									onBlur={onNoteSpeedCommit}
									onKeyDown={(event) => {
										if (event.key === "Enter") onNoteSpeedCommit?.();
									}}
									step={0.05}
									type="number"
									value={displayNoteSpeed ?? (noteSpeed / 2.6).toFixed(2)}
								/>
								<span>倍</span>
							</div>
						</label>
					)}
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
			{commentListEnabled && (
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
										<li key={comment.id}>
											<button
												className="block w-full rounded-lg py-3 text-left transition first:pt-0 last:pb-0 hover:bg-sky-50 hover:text-sky-900"
												onClick={() => onCommentSelect?.(comment)}
												type="button"
											>
												<strong className="block text-sm text-slate-800">
													{comment.displayName}
												</strong>
												<span className="mt-1 block text-xs text-slate-400">
													{comment.position.toFixed(2)} 拍 ・ レーン{" "}
													{comment.lanePosition.toFixed(1)}
												</span>
												<span className="mt-1 block whitespace-pre-wrap text-sm leading-5 text-slate-600">
													{comment.body}
												</span>
											</button>
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
			)}
		</div>
	);
}
