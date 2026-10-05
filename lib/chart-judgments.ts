import type { ChartData, Note, SlidePoint, TapKind } from "@/lib/chart-model";
import { sideXTapPairs } from "@/lib/chart-note-relations";
import { positionValue } from "@/lib/chart-position";

export type JudgmentSound =
	| "tap"
	| "flick"
	| "sideTap"
	| "hold"
	| "sideHold"
	| "slideHold";

export interface ChartJudgment {
	beat: number;
	sound: JudgmentSound;
}

export interface SustainedSoundTransition {
	beat: number;
	sideHoldCount: number;
	slideHoldCount: number;
}

export interface ChartSoundPlan {
	judgments: ChartJudgment[];
	sustainedTransitions: SustainedSoundTransition[];
}

function soundForTap(tap: TapKind): JudgmentSound {
	switch (tap.type) {
		case "xTap":
			return "flick";
		case "flick":
			return "flick";
		default:
			return "tap";
	}
}

function slidePointJudgments(
	points: SlidePoint[],
	startBeat: number,
	isSideLane: boolean,
): ChartJudgment[] {
	let startPointConsumed = false;
	return [
		{
			beat: startBeat,
			sound: isSideLane ? ("sideTap" as const) : ("tap" as const),
		},
		...points.flatMap((point) => {
			if (point.kind !== "visible") return [];
			const beat = positionValue(point.position);
			if (!startPointConsumed && beat === startBeat) {
				startPointConsumed = true;
				return [];
			}
			return [
				{
					beat,
					sound: isSideLane ? ("sideTap" as const) : ("hold" as const),
				},
			];
		}),
	];
}

function noteJudgments(
	note: Note,
	sideXTapAirNotes: ReadonlySet<number>,
): ChartJudgment[] {
	const beat = positionValue(note.position);
	const isSideLane = note.lane.type === "side";
	switch (note.kind.type) {
		case "mine":
			return [];
		case "tap":
			return [
				{
					beat,
					sound: isSideLane
						? note.kind.tap.type === "xTap"
							? "flick"
							: "sideTap"
						: soundForTap(note.kind.tap),
				},
			];
		case "exTap":
			return [{ beat, sound: "flick" }];
		case "hold":
		case "exHold":
		case "airHold":
			return [
				{ beat, sound: isSideLane ? "sideTap" : "hold" },
				...(note.kind.type === "hold" ||
				note.kind.type === "exHold" ||
				note.kind.type === "airHold"
					? note.kind.checkpoints.map((checkpoint) => ({
							beat: positionValue(checkpoint),
							sound: isSideLane ? ("sideTap" as const) : ("hold" as const),
						}))
					: []),
				{
					beat: positionValue(note.kind.end),
					sound: isSideLane ? "sideTap" : "hold",
				},
			];
		case "slide":
		case "exSlide":
		case "airSlide":
		case "airCrush":
			return slidePointJudgments(note.kind.points, beat, isSideLane);
		case "air":
			return [
				{
					beat,
					sound: sideXTapAirNotes.has(note.id)
						? "flick"
						: isSideLane ||
								(note.kind.properties.direction !== null &&
									[
										"upperLeft",
										"upperRight",
										"lowerLeft",
										"lowerRight",
									].includes(note.kind.properties.direction))
							? "sideTap"
							: "tap",
				},
			];
	}
}

function sustainedSoundInterval(note: Note) {
	const start = positionValue(note.position);
	if (
		(note.kind.type === "hold" ||
			note.kind.type === "exHold" ||
			note.kind.type === "airHold") &&
		note.lane.type === "side"
	) {
		return {
			sound: "sideHold" as const,
			start,
			end: positionValue(note.kind.end),
		};
	}
	if (note.kind.type === "slide" || note.kind.type === "exSlide") {
		const end = note.kind.points.at(-1);
		if (end) {
			return {
				sound: "slideHold" as const,
				start,
				end: positionValue(end.position),
			};
		}
	}
	return undefined;
}

/** Visible points judge; control and invisible points only shape the slide. */
export function chartSoundPlan(chart: ChartData): ChartSoundPlan {
	const sideXTapRelations = sideXTapPairs(chart);
	const sideXTapParents = new Set(
		sideXTapRelations.map((relation) => relation.parentId),
	);
	const sideXTapAirNotes = new Set(
		sideXTapRelations.map((relation) => relation.airNoteId),
	);
	const judgments = chart.notes
		.filter(
			(note) =>
				!(
					sideXTapParents.has(note.id) &&
					note.kind.type === "tap" &&
					note.kind.tap.type === "xTap"
				),
		)
		.flatMap((note) => noteJudgments(note, sideXTapAirNotes));
	const changes = new Map<number, { sideHold: number; slideHold: number }>();
	for (const note of chart.notes) {
		const interval = sustainedSoundInterval(note);
		if (!interval || interval.end <= interval.start) continue;
		const start = changes.get(interval.start) ?? { sideHold: 0, slideHold: 0 };
		const end = changes.get(interval.end) ?? { sideHold: 0, slideHold: 0 };
		start[interval.sound] += 1;
		end[interval.sound] -= 1;
		changes.set(interval.start, start);
		changes.set(interval.end, end);
	}
	let sideHoldCount = 0;
	let slideHoldCount = 0;
	const sustainedTransitions = [...changes]
		.sort(([left], [right]) => left - right)
		.map(([beat, change]) => {
			sideHoldCount += change.sideHold;
			slideHoldCount += change.slideHold;
			return { beat, sideHoldCount, slideHoldCount };
		});
	return {
		judgments: judgments.sort((left, right) => left.beat - right.beat),
		sustainedTransitions,
	};
}
