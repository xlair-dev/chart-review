const defaultMaxUploadSizeBytes = 50 * 1024 * 1024;

export function maxChartUploadSizeBytes() {
	const configured = process.env.CHART_REVIEW_MAX_UPLOAD_SIZE_BYTES;
	if (configured === undefined || configured === "")
		return defaultMaxUploadSizeBytes;

	const size = Number(configured);
	if (!Number.isSafeInteger(size) || size <= 0) {
		throw new Error(
			"CHART_REVIEW_MAX_UPLOAD_SIZE_BYTES は正の整数で設定してください。",
		);
	}
	return size;
}
