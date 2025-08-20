// src/ark-adapter.ts
import { type Type as ArkType, type } from "arktype";

export type SafeParseResult<T> =
	| { data: T; problems: null }
	| { data: null; problems: { summary: string } };

export const toSafeParse =
	<T>(schema: ArkType<T>) =>
	(value: unknown): SafeParseResult<T> => {
		const out = schema(value);
		if (out instanceof type.errors) {
			return { data: null, problems: { summary: out.summary } };
		}
		return { data: out as T, problems: null };
	};

export const safeFetchJson = async <T>(url: string, schema: ArkType<T>) => {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
	const json: unknown = await res.json();

	const { data, problems } = toSafeParse(schema)(json);
	if (problems) throw new Error(problems.summary);
	return data!;
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

/**
 * export const fetchTodos = () =>
  withRetry((signal) => safeFetchJson(TODOS_URL, Todos, { signal }));

export const fetchTodoCoerced = (id: number) =>
  withRetry((signal) =>
    safeFetchJson(`${TODOS_URL}/${id}`, CoercedTodo, { signal })
  );
*/
