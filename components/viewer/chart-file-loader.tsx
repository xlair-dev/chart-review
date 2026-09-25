"use client";

import { useState } from "react";
import { ChartRenderer } from "@/components/viewer/chart-renderer";
import type { ChartData } from "@/lib/chart-model";
import { parseChartFile } from "@/lib/chart-parser";

export function ChartFileLoader() {
	const [chart, setChart] = useState<ChartData>();
	const [fileName, setFileName] = useState<string>();
	const [error, setError] = useState<string>();
	const [isLoading, setIsLoading] = useState(false);

	async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		setChart(undefined);
		setFileName(file.name);
		setError(undefined);
		setIsLoading(true);
		try {
			setChart(await parseChartFile(file));
		} catch (parseError) {
			setError(
				parseError instanceof Error
					? parseError.message
					: "譜面を読み込めませんでした。",
			);
		} finally {
			setIsLoading(false);
			event.target.value = "";
		}
	}

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
			<div className="flex flex-wrap items-start justify-between gap-5">
				<div>
					<p className="text-xs font-semibold tracking-[0.18em] text-sky-700">
						LOCAL CHART
					</p>
					<h2 className="mt-3 text-2xl font-semibold">譜面を開く</h2>
					<p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
						譜面ファイルはブラウザー内で解析します。対応形式は C2S、SUS、UGC
						です。
					</p>
				</div>
				<label className="inline-flex cursor-pointer items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 has-[input:disabled]:cursor-wait has-[input:disabled]:opacity-60">
					{isLoading ? "解析中…" : "ファイルを選択"}
					<input
						accept=".c2s,.sus,.ugc"
						className="sr-only"
						disabled={isLoading}
						onChange={handleFileChange}
						type="file"
					/>
				</label>
			</div>

			<div aria-live="polite" className="mt-8 rounded-xl bg-slate-50 p-5">
				{error ? (
					<p className="text-sm text-rose-700">{error}</p>
				) : chart ? (
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div>
							<p className="text-sm font-semibold text-slate-800">{fileName}</p>
							<p className="mt-1 text-sm text-slate-500">
								{chart.format.toUpperCase()} ・ {chart.notes.length} ノーツ
								{chart.baseBpm === null ? "" : ` ・ ${chart.baseBpm} BPM`}
							</p>
						</div>
						<p className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
							解析完了
						</p>
					</div>
				) : (
					<p className="text-sm leading-6 text-slate-500">
						ファイルを選択すると、譜面の解析結果がここに表示されます。
					</p>
				)}
			</div>
			{chart && (
				<div className="mt-8">
					<ChartRenderer chart={chart} />
				</div>
			)}
		</section>
	);
}
