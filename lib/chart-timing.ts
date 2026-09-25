import type { ChartData } from "@/lib/chart-model";
import { positionValue } from "@/lib/chart-position";

type TempoPoint = { beat: number; bpm: number };

function tempoPoints(chart: ChartData): TempoPoint[] {
	const points = [
		...(chart.baseBpm === null ? [] : [{ beat: 0, bpm: chart.baseBpm }]),
		...chart.tempoChanges.map((change) => ({
			beat: positionValue(change.position),
			bpm: change.bpm,
		})),
	].sort((left, right) => left.beat - right.beat);
	const uniquePoints = new Map<number, TempoPoint>();
	for (const point of points) uniquePoints.set(point.beat, point);
	return [...uniquePoints.values()].filter(
		(point) => point.bpm > 0 && Number.isFinite(point.bpm),
	);
}

export function supportsChartTiming(chart: ChartData): boolean {
	const firstPoint = tempoPoints(chart)[0];
	return firstPoint !== undefined && firstPoint.beat === 0;
}

export function secondsAtBeat(chart: ChartData, beat: number): number {
	const points = tempoPoints(chart);
	if (points.length === 0 || points[0].beat !== 0 || beat <= 0) return 0;
	let elapsed = 0;
	for (let index = 0; index < points.length; index++) {
		const point = points[index];
		if (beat <= point.beat) break;
		const nextBeat = Math.min(beat, points[index + 1]?.beat ?? beat);
		elapsed += ((nextBeat - point.beat) * 60) / point.bpm;
		if (nextBeat === beat) break;
	}
	return elapsed;
}

export function positionAtSeconds(chart: ChartData, seconds: number): number {
	const points = tempoPoints(chart);
	if (points.length === 0 || points[0].beat !== 0 || seconds <= 0) return 0;
	let elapsed = 0;
	for (let index = 0; index < points.length; index++) {
		const point = points[index];
		const nextBeat = points[index + 1]?.beat;
		const duration =
			nextBeat === undefined
				? Number.POSITIVE_INFINITY
				: ((nextBeat - point.beat) * 60) / point.bpm;
		if (seconds <= elapsed + duration) {
			return point.beat + ((seconds - elapsed) * point.bpm) / 60;
		}
		elapsed += duration;
	}
	return 0;
}
