import { describe, expect, it } from 'vitest';

import { isTestOnly, modelLabel, testOnlyUseLabel, withCurrent } from './models';

const models = [
	{ id: 'local', test_only: false },
	{ id: 'hosted', test_only: true }
];

describe('models', () => {
	it('marks test-only models in pickers', () => {
		expect(modelLabel(models[0])).toBe('local');
		expect(modelLabel(models[1])).toBe('hosted (test only)');
	});

	it('keeps a configured model that is no longer offered, as test only', () => {
		expect(withCurrent(models, 'local')).toBe(models);
		expect(withCurrent(models, null)).toBe(models);
		expect(withCurrent(models, 'gone')[0]).toEqual({ id: 'gone', test_only: true });
	});

	it('counts unknown models as test only', () => {
		expect(isTestOnly(models, 'local')).toBe(false);
		expect(isTestOnly(models, 'hosted')).toBe(true);
		expect(isTestOnly(models, 'gone')).toBe(true);
		expect(isTestOnly(models, '')).toBe(false);
	});

	it('names agents and speech', () => {
		expect(testOnlyUseLabel('probing')).toBe('Probing agent');
		expect(testOnlyUseLabel('speech')).toBe('Speech (audio answers)');
	});
});

describe('describeModel', () => {
	it('splits the provider prefix off', async () => {
		const { describeModel } = await import('./models');
		expect(describeModel('openrouter:google/gemma-4-31b-it')).toEqual({
			provider: 'OpenRouter',
			name: 'google/gemma-4-31b-it'
		});
		expect(describeModel('openai/gpt-oss-120b')).toEqual({
			provider: 'Self-hosted',
			name: 'openai/gpt-oss-120b'
		});
		expect(describeModel('newcloud:x')).toEqual({ provider: 'newcloud', name: 'x' });
	});
});
