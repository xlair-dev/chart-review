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

export function positionFromValue(value: number): Position {
	const denominator = BigInt(1_000_000);
	const numerator = BigInt(
		Math.max(0, Math.round(value * Number(denominator))),
	);
	let left = numerator;
	let right = denominator;
	while (right !== BigInt(0)) {
		const remainder = left % right;
		left = right;
		right = remainder;
	}
	const divisor = left === BigInt(0) ? BigInt(1) : left;
	return {
		numerator: (numerator / divisor).toString(),
		denominator: (denominator / divisor).toString(),
	};
}
