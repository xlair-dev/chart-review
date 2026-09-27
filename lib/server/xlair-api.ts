import "server-only";
import {
	getAuth0AccessToken,
	XlairApiConfigurationError,
} from "@/lib/server/auth0-access-token";

export { XlairApiConfigurationError };

export async function fetchXlairApi(
	path: string | URL,
	init: RequestInit = {},
): Promise<Response> {
	const serverUrl = process.env.CHART_REVIEW_SERVER_URL;
	if (!serverUrl) {
		throw new XlairApiConfigurationError(
			"CHART_REVIEW_SERVER_URL を設定してください。",
		);
	}

	const baseUrl = new URL(serverUrl);
	const targetUrl = new URL(path, baseUrl);
	if (targetUrl.origin !== baseUrl.origin) {
		throw new Error(
			"XLAIR API の URL が設定済み server origin と一致しません。",
		);
	}

	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${await getAuth0AccessToken()}`);
	return fetch(targetUrl, { ...init, cache: "no-store", headers });
}
