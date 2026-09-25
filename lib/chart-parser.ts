import type { ChartData, ChartFormat } from "@/lib/chart-model";

interface ChartParserModule {
	default: () => Promise<unknown>;
	parse_chart_json: (format: string, source: Uint8Array) => string;
}

let chartParser: Promise<ChartParserModule> | undefined;

function loadChartParser(): Promise<ChartParserModule> {
	if (!chartParser) {
		const moduleUrl = new URL(
			"/wasm/chart-parser/chart_review_parser.js",
			window.location.origin,
		).href;
		chartParser = import(/* webpackIgnore: true */ moduleUrl)
			.then(async (module: ChartParserModule) => {
				await module.default();
				return module;
			})
			.catch((error: unknown) => {
				chartParser = undefined;
				throw error;
			});
	}

	return chartParser;
}

function chartFormat(file: File): ChartFormat {
	const extension = file.name.split(".").at(-1)?.toLowerCase();
	if (extension === "c2s" || extension === "sus" || extension === "ugc") {
		return extension;
	}

	throw new Error("C2S、SUS、UGC 形式の譜面を選んでください。");
}

export async function parseChartFile(file: File): Promise<ChartData> {
	const format = chartFormat(file);
	const bytes = new Uint8Array(await file.arrayBuffer());
	const module = await loadChartParser();
	return JSON.parse(module.parse_chart_json(format, bytes)) as ChartData;
}
