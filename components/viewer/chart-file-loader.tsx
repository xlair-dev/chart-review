"use client";

import { useEffect, useState } from "react";
import { ChartPlayback } from "@/components/viewer/chart-playback";
import type { CatalogItem } from "@/lib/catalog-model";
import type { ChartData } from "@/lib/chart-model";
import { type ChartMode, parseChartFile } from "@/lib/chart-parser";

export function ChartFileLoader() {
	const [catalog, setCatalog] = useState<CatalogItem[]>();
	const [musicId, setMusicId] = useState("");
	const [chart, setChart] = useState<ChartData>();
	const [chartFileName, setChartFileName] = useState<string>();
	const [error, setError] = useState<string>();
	const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [playground, setPlayground] = useState(false);
	const [chartMode, setChartMode] = useState<ChartMode>("xlair");
	const [chartFile, setChartFile] = useState<File>();
	const [audioUrl, setAudioUrl] = useState<string>();
	const [audioFileName, setAudioFileName] = useState<string>();
	const selectedMusic = catalog?.find(
		(item) => item.music.id === musicId,
	)?.music;
	useEffect(() => {
		if (!audioUrl) return;
		return () => URL.revokeObjectURL(audioUrl);
	}, [audioUrl]);

	useEffect(() => {
		let active = true;
		async function loadCatalog() {
			try {
				const response = await fetch("/api/catalog", { cache: "no-store" });
				if (!response.ok) throw new Error("曲一覧を取得できませんでした。");
				const entries = (await response.json()) as CatalogItem[];
				if (active) setCatalog(entries);
			} catch (loadError) {
				if (active) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "曲一覧を取得できませんでした。",
					);
				}
			} finally {
				if (active) setIsLoadingCatalog(false);
			}
		}
		void loadCatalog();
		return () => {
			active = false;
		};
	}, []);

	function handleMusicChange(event: React.ChangeEvent<HTMLSelectElement>) {
		setMusicId(event.target.value);
		setError(undefined);
	}

	async function handleChartChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;

		setChart(undefined);
		setChartFile(file);
		setChartFileName(file.name);
		setError(undefined);
		setIsLoading(true);
		try {
			setChart(await parseChartFile(file, playground ? chartMode : "xlair"));
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

	async function changeChartMode(mode: ChartMode) {
		setChartMode(mode);
		if (!chartFile) return;
		setChart(undefined);
		setError(undefined);
		setIsLoading(true);
		try {
			setChart(await parseChartFile(chartFile, mode));
		} catch (parseError) {
			setError(
				parseError instanceof Error
					? parseError.message
					: "譜面を読み込めませんでした。",
			);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
			<label className="mb-6 flex items-center gap-3 text-sm font-medium text-slate-700">
				<input
					checked={playground}
					className="size-4 accent-sky-700"
					onChange={(event) => {
						setPlayground(event.target.checked);
						if (!event.target.checked) void changeChartMode("xlair");
					}}
					type="checkbox"
				/>
				Playground モード
			</label>
			<div>
				<p className="text-xs font-semibold tracking-[0.18em] text-sky-700">
					LOCAL CHART
				</p>
				<h2 className="mt-3 text-2xl font-semibold">曲と譜面を選ぶ</h2>
				<p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
					{playground
						? "任意の音源と譜面を選び、解釈モードを切り替えて確認する。"
						: "同期済みの曲を選び、譜面ファイルだけをブラウザー内で読み込んで確認する。"}
				</p>
			</div>

			{playground && (
				<div className="mt-6 space-y-4">
					<label className="block text-sm font-medium text-slate-700">
						音源
						<span className="mt-2 flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 font-normal hover:bg-slate-50">
							{audioFileName ?? "音源ファイルを選択"}
							<input
								accept="audio/*"
								className="sr-only"
								onChange={(event) => {
									const file = event.target.files?.[0];
									setAudioUrl(file ? URL.createObjectURL(file) : undefined);
									setAudioFileName(file?.name);
									event.target.value = "";
								}}
								type="file"
							/>
						</span>
					</label>
					<fieldset className="flex gap-4 text-sm text-slate-700">
						<legend className="mb-2 font-medium">譜面の解釈</legend>
						{(
							[
								["xlair", "XLAIR モード"],
								["normal", "通常モード"],
							] as const
						).map(([mode, label]) => (
							<label className="flex items-center gap-2" key={mode}>
								<input
									checked={chartMode === mode}
									disabled={isLoading}
									name="chart-mode"
									onChange={() => void changeChartMode(mode)}
									type="radio"
								/>
								{label}
							</label>
						))}
					</fieldset>
				</div>
			)}

			<div className="mt-6 grid gap-4 sm:grid-cols-2">
				{!playground && (
					<label className="block text-sm font-medium text-slate-700">
						曲
						<select
							className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
							disabled={isLoadingCatalog}
							onChange={handleMusicChange}
							value={musicId}
						>
							<option value="">
								{isLoadingCatalog
									? "曲一覧を読み込み中…"
									: "曲を選択してください"}
							</option>
							{catalog
								?.filter((item) => item.music.audio)
								.map((item) => (
									<option key={item.music.id} value={item.music.id}>
										{item.music.title} — {item.music.artist}
									</option>
								))}
						</select>
					</label>
				)}
				<label className="block text-sm font-medium text-slate-700">
					譜面
					<span className="mt-2 flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-700 hover:bg-slate-50">
						{isLoading ? "解析中…" : (chartFileName ?? "譜面ファイルを選択")}
						<input
							accept=".c2s,.sus,.ugc"
							className="sr-only"
							disabled={isLoading}
							onChange={handleChartChange}
							type="file"
						/>
					</span>
				</label>
			</div>

			<div aria-live="polite" className="mt-6 rounded-xl bg-slate-50 p-5">
				{error ? (
					<p className="text-sm text-rose-700">{error}</p>
				) : chart ? (
					<div>
						<p className="text-sm font-semibold text-slate-800">
							{chartFileName}
						</p>
						<p className="mt-1 text-sm text-slate-500">
							{chart.format.toUpperCase()} ・ {chart.notes.length} ノーツ
							{chart.baseBpm === null ? "" : ` ・ ${chart.baseBpm} BPM`}
						</p>
					</div>
				) : (
					<p className="text-sm leading-6 text-slate-500">
						譜面ファイルを選択すると、解析結果がここに表示されます。
					</p>
				)}
			</div>
			{chart && (playground ? audioUrl : selectedMusic?.audio?.url) && (
				<div className="mt-8">
					<ChartPlayback
						audioSource={playground ? audioUrl : selectedMusic?.audio?.url}
						audioSourceLabel={
							playground
								? "選択した音源はこのブラウザー内だけで使います。"
								: undefined
						}
						allowLocalAudioSelection={!playground}
						chart={chart}
					/>
				</div>
			)}
		</section>
	);
}
