import type { AirDirection, ChartData, SideButton } from "@/lib/chart-model";

export interface SideXTapPair {
	parentId: number;
	airNoteId: number;
	button: SideButton;
}

function sideButtonFor(direction: AirDirection | null): SideButton | undefined {
	switch (direction) {
		case "upperLeft":
			return "leftUpper";
		case "upperRight":
			return "rightUpper";
		case "lowerLeft":
			return "leftLower";
		case "lowerRight":
			return "rightLower";
		default:
			return undefined;
	}
}

/** Resolves converter-encoded side X-taps represented by X-tap parents and diagonal AIR children. */
export function sideXTapPairs(chart: ChartData): SideXTapPair[] {
	const xTapIds = new Set(
		chart.notes
			.filter(
				(note) => note.kind.type === "tap" && note.kind.tap.type === "xTap",
			)
			.map((note) => note.id),
	);

	return chart.notes.flatMap((note) => {
		if (note.kind.type !== "air" || !xTapIds.has(note.kind.parent)) return [];
		const button = sideButtonFor(note.kind.properties.direction);
		return button
			? [{ parentId: note.kind.parent, airNoteId: note.id, button }]
			: [];
	});
}
