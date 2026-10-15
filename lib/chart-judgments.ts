import type {
	ChartData,
	Lane,
	Note,
	SlidePoint,
	TapKind,
} from "@/lib/chart-model";
import { sideXTapPairs } from "@/lib/chart-note-relations";
import { positionValue } from "@/lib/chart-position";

export type JudgmentSound =
	| "tap"
	| "slideTap"
	| "xTap"
	| "flick"
	| "sideTap"
	| "checkpoint"
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

function soundForTap(tap: TapKind, isSideLane: boolean): JudgmentSound {
	switch (tap.type) {
		case "tap":
			return isSideLane ? "sideTap" : "tap";
		case "xTap":
			return "xTap";
		case "flick":
			return "flick";
		case "tap4":
		case "tap5":
		case "tap6":
			return isSideLane ? "sideTap" : "tap";
	}
}

function sameLane(left: Lane, right: Lane): boolean {
	if (left.type !== right.type) return false;
	if (left.type === "side" && right.type === "side") {
		return left.button === right.button;
	}
	return (
		left.type === "slider" &&
		right.type === "slider" &&
		left.start === right.start &&
		left.width === right.width
	);
}

/** X-tap starts use co-located X-tap notes; side X-taps use their paired AIR note. */
function xTapStartNotes(
	chart: ChartData,
	sideXTapRelations: ReturnType<typeof sideXTapPairs>,
): ReadonlySet<number> {
	const sideXTapParents = new Set(
		sideXTapRelations.map((relation) => relation.parentId),
	);
	const xTapNotes = chart.notes.filter(
		(note) =>
			note.kind.type === "tap" &&
			note.kind.tap.type === "xTap" &&
			!sideXTapParents.has(note.id),
	);
	const notesById = new Map(chart.notes.map((note) => [note.id, note]));
	return new Set(
		chart.notes.flatMap((note) => {
			const isCenterSlide =
				note.lane.type === "slider" &&
				(note.kind.type === "slide" || note.kind.type === "exSlide");
			const isSideHold =
				note.lane.type === "side" &&
				(note.kind.type === "hold" ||
					note.kind.type === "exHold" ||
					note.kind.type === "airHold");
			if (!isCenterSlide && !isSideHold) return [];

			const startBeat = positionValue(note.position);
			const hasXTapNote = xTapNotes.some(
				(xTap) =>
					positionValue(xTap.position) === startBeat &&
					sameLane(xTap.lane, note.lane),
			);
			const sideButton =
				note.lane.type === "side" ? note.lane.button : undefined;
			const hasSideXTap =
				sideButton !== undefined &&
				sideXTapRelations.some((relation) => {
					if (relation.button !== sideButton) return false;
					const airNote = notesById.get(relation.airNoteId);
					return (
						airNote !== undefined &&
						positionValue(airNote.position) === startBeat
					);
				});
			return hasXTapNote || hasSideXTap ? [note.id] : [];
		}),
	);
}

function slidePointJudgments(
	points: SlidePoint[],
	startBeat: number,
	startsWithXTap: boolean,
): ChartJudgment[] {
	let startPointConsumed = false;
	const judgments = [
		...(startsWithXTap
			? []
			: [{ beat: startBeat, sound: "slideTap" as const }]),
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
					sound: "checkpoint" as const,
				},
			];
		}),
	];
	const endPoint = points.at(-1);
	if (endPoint) {
		const endBeat = positionValue(endPoint.position);
		if (
			!judgments.some(
				(judgment) =>
					judgment.beat === endBeat && judgment.sound === "checkpoint",
			)
		) {
			judgments.push({ beat: endBeat, sound: "checkpoint" });
		}
	}
	return judgments;
}

function noteJudgments(
	note: Note,
	sideXTapAirNotes: ReadonlySet<number>,
	xTapStartNotes: ReadonlySet<number>,
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
					sound: soundForTap(note.kind.tap, isSideLane),
				},
			];
		case "exTap":
			return [{ beat, sound: "xTap" }];
		case "hold":
		case "exHold":
		case "airHold":
			return [
				...(xTapStartNotes.has(note.id)
					? []
					: [
							{
								beat,
								sound: isSideLane
									? ("sideTap" as const)
									: ("checkpoint" as const),
							},
						]),
				...(note.kind.type === "hold" ||
				note.kind.type === "exHold" ||
				note.kind.type === "airHold"
					? note.kind.checkpoints.map((checkpoint) => ({
							beat: positionValue(checkpoint),
							sound: "checkpoint" as const,
						}))
					: []),
				{
					beat: positionValue(note.kind.end),
					sound: "checkpoint",
				},
			];
		case "slide":
		case "exSlide":
		case "airSlide":
		case "airCrush":
			return slidePointJudgments(
				note.kind.points,
				beat,
				xTapStartNotes.has(note.id),
			);
		case "air":
			return [
				{
					beat,
					sound: sideXTapAirNotes.has(note.id)
						? "xTap"
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
	const xTapStarts = xTapStartNotes(chart, sideXTapRelations);
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
		.flatMap((note) => noteJudgments(note, sideXTapAirNotes, xTapStarts));
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
