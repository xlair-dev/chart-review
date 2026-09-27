import "server-only";

type CachedToken = {
	value: string;
	expiresAt: number;
};

type TokenCacheEntry = {
	token?: CachedToken;
	pending?: Promise<CachedToken>;
};

type Auth0TokenResponse = {
	access_token?: unknown;
	expires_in?: unknown;
};

const tokenExpiryBufferMs = 30_000;

const globalAuth0 = globalThis as typeof globalThis & {
	chartReviewAuth0Tokens?: Map<string, TokenCacheEntry>;
};

/** Keeps each XLAIR Web access token in this Node.js process until shortly before expiry. */
export async function getAuth0AccessToken(): Promise<string> {
	const config = auth0Config();
	const key = `${config.domain}:${config.audience}:${config.clientId}`;
	let tokens = globalAuth0.chartReviewAuth0Tokens;
	if (!tokens) {
		tokens = new Map();
		globalAuth0.chartReviewAuth0Tokens = tokens;
	}
	let entry = tokens.get(key);
	if (!entry) {
		entry = {};
		tokens.set(key, entry);
	}

	if (entry.token && entry.token.expiresAt > Date.now())
		return entry.token.value;
	if (entry.pending) return (await entry.pending).value;

	entry.pending = requestAccessToken(config);
	try {
		entry.token = await entry.pending;
		return entry.token.value;
	} finally {
		entry.pending = undefined;
	}
}

export class XlairApiConfigurationError extends Error {}

type Auth0Config = {
	domain: string;
	audience: string;
	clientId: string;
	clientSecret: string;
};

function auth0Config(): Auth0Config {
	const config = {
		domain: process.env.AUTH0_DOMAIN,
		audience: process.env.AUTH0_AUDIENCE,
		clientId: process.env.AUTH0_CLIENT_ID,
		clientSecret: process.env.AUTH0_CLIENT_SECRET,
	};
	const missing = [
		!config.domain && "AUTH0_DOMAIN",
		!config.audience && "AUTH0_AUDIENCE",
		!config.clientId && "AUTH0_CLIENT_ID",
		!config.clientSecret && "AUTH0_CLIENT_SECRET",
	].filter((key): key is string => Boolean(key));
	if (missing.length > 0) {
		throw new XlairApiConfigurationError(
			`Auth0 の設定が不足しています: ${missing.join(", ")}`,
		);
	}
	return {
		domain: config.domain as string,
		audience: config.audience as string,
		clientId: config.clientId as string,
		clientSecret: config.clientSecret as string,
	};
}

async function requestAccessToken(config: Auth0Config): Promise<CachedToken> {
	const response = await fetch(
		new URL("/oauth/token", `https://${config.domain}`),
		{
			method: "POST",
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				client_id: config.clientId,
				client_secret: config.clientSecret,
				audience: config.audience,
				grant_type: "client_credentials",
			}),
		},
	);
	if (!response.ok) {
		throw new Error(
			`Auth0 アクセストークンを取得できませんでした（${response.status}）。`,
		);
	}

	const result = (await response.json()) as Auth0TokenResponse;
	if (
		typeof result.access_token !== "string" ||
		typeof result.expires_in !== "number" ||
		!Number.isFinite(result.expires_in) ||
		result.expires_in <= 0
	) {
		throw new Error("Auth0 のアクセストークン応答が不正です。");
	}

	return {
		value: result.access_token,
		expiresAt:
			Date.now() + Math.max(0, result.expires_in * 1000 - tokenExpiryBufferMs),
	};
}
