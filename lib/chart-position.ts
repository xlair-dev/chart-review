import type { Position } from "@/lib/chart-model";

/** Approximates exact beat positions to bounded precision for Canvas geometry. */
export function positionValue(position: Position): number {
	try {
		const numerator = BigInt(position.numerator);
		const denominator = BigInt(position.denominator);
		if (denominator <= BigInt(0)) return 0;
		const precision = BigInt(1_000_000);
		return Number((numerator * precision) / denominator) / Number(precision);
	} catch {
		return 0;
	}
}
