import type { Type as ArkType } from "arktype";

type FetchJsonOptions = {
	signal?: AbortSignal;
};

export const safeFetchJson = async <T>(
	url: string,
	schema: ArkType<T>,
	opts: FetchJsonOptions = {},
): Promise<T> => {
	const res = await fetch(url, { signal: opts.signal });
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
	}
	const json: unknown = await res.json();
	const out = schema(json);
	if (out instanceof (schema as any).errors ?? false) {
		// Using ArkType's canonical error surface: out.summary
		// (out is an ArkErrors instance)
		const summary = (out as any).summary as string;
		throw new Error(`Validation failed for ${url}: ${summary}`);
	}
	return out as T;
};

export const withRetry = async <T>(
	fn: (signal: AbortSignal) => Promise<T>,
	{
		retries = 3,
		baseDelayMs = 300,
	}: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> => {
	let attempt = 0;
	while (true) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10_000);
		try {
			return await fn(controller.signal);
		} catch (err) {
			attempt++;
			if (attempt > retries) throw err;
			const delay = baseDelayMs * 2 ** (attempt - 1);
			await new Promise((r) => setTimeout(r, delay));
		} finally {
			clearTimeout(timeout);
		}
	}
};
