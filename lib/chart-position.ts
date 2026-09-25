import type { Position } from "@/lib/chart-model";

export function positionValue(position: Position): number {
	const numerator = Number(position.numerator);
	const denominator = Number(position.denominator);
	return denominator === 0 ? 0 : numerator / denominator;
}
