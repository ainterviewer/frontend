// Models a project's agents may use, and which are for test interviews only:
// respondents' answers may not be sent to those, so the backend refuses to
// publish a project that uses one (`test_only` on the versions status and on
// `cannot_publish`, see the backend's app/distribution.py).

import type { ModelOption } from '$lib/api/types.gen';

import { AGENT_LABEL } from './labels';

/** The key the backend reports speech under, beside the agents' names. */
export const SPEECH = 'speech';

/** A model's name in a picker, marked when it is for tests only. */
export function modelLabel(model: ModelOption): string {
	return model.test_only ? `${model.id} (test only)` : model.id;
}

/**
 * The options for a picker showing `current`. A model no longer offered
 * (removed from the deployment since it was configured) is kept so the
 * select does not render blank, and counts as test only, as the backend
 * counts any model it does not list as distributable.
 */
export function withCurrent(models: ModelOption[], current?: string | null): ModelOption[] {
	if (!current || models.some((m) => m.id === current)) return models;
	return [{ id: current, test_only: true }, ...models];
}

/** Whether `id` is for test interviews only; unknown models are. */
export function isTestOnly(models: ModelOption[], id: string | null | undefined): boolean {
	if (!id) return false;
	return models.find((m) => m.id === id)?.test_only ?? true;
}

/** What a `test_only` entry is called: an agent's label, or speech. */
export function testOnlyUseLabel(key: string): string {
	return key === SPEECH ? 'Speech (audio answers)' : `${AGENT_LABEL[key] ?? key} agent`;
}

const PROVIDERS: Record<string, string> = {
	openrouter: 'OpenRouter',
	openai: 'OpenAI',
	gemini: 'Google',
	alex: 'Alexandra Institute'
};

/**
 * A model id split for display: who serves it, from its prefix as the
 * backend routes it (`lpm/clients.py`), and the model's own name. An id with
 * no prefix goes to the deployment's own vLLM server.
 */
export function describeModel(id: string): { provider: string; name: string } {
	const colon = id.indexOf(':');
	if (colon === -1) return { provider: 'Self-hosted', name: id };
	const prefix = id.slice(0, colon);
	return { provider: PROVIDERS[prefix] ?? prefix, name: id.slice(colon + 1) };
}
