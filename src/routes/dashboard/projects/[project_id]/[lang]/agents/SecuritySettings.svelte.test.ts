import '/src/app.css';

import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import type { SecurityConfig, SecurityPolicy } from '$lib/api';

import SecuritySettings from './SecuritySettings.svelte';

const defaultPolicy: SecurityPolicy = {
	decisions: [
		{
			name: 'self_harm',
			description: 'Does the respondent intend to harm themselves?',
			threshold: 0.3,
			action: 'end_interview',
			action_text: 'Our automated safety system has triggered an intervention.',
			respondent_override: false
		}
	]
};

function renderSettings() {
	const security: SecurityConfig = $state({
		include: false,
		model: 'model',
		temperature: 0.7,
		policy: structuredClone(defaultPolicy)
	});
	render(SecuritySettings, { security, models: ['model'], mode: 'basic', defaultPolicy });
	return security;
}

test('edits the config in place', async () => {
	const security = renderSettings();

	await page.getByLabelText('Run the safety check during interviews').click();
	await page.getByLabelText('Threshold').fill('0.6');
	await page.getByLabelText('Action').selectOptions('Skip the remaining probes');

	expect(security.include).toBe(true);
	expect(security.policy?.decisions[0]).toMatchObject({ threshold: 0.6, action: 'skip_probes' });
});

test('adds, flags, removes and resets decisions', async () => {
	const security = renderSettings();

	await page.getByRole('button', { name: 'Add decision' }).click();
	expect(security.policy?.decisions.map((d) => d.name)).toEqual(['self_harm', 'decision_2']);
	// The new decision has no question yet.
	await expect.element(page.getByText('The question for the model is empty.')).toBeVisible();

	await page.getByRole('button', { name: 'Remove' }).first().click();
	expect(security.policy?.decisions.map((d) => d.name)).toEqual(['decision_2']);

	await page.getByRole('button', { name: 'Reset to default' }).click();
	expect(security.policy).toEqual(defaultPolicy);
});

test('shows the model and temperature only in advanced mode', async () => {
	renderSettings();

	await expect.element(page.getByLabelText('Model', { exact: true })).not.toBeInTheDocument();
});
