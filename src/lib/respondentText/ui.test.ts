import { describe, expect, it } from 'vitest';

import { LANGS, toLang } from './lang';
import { getUiText, splitWithdraw } from './ui';

describe('toLang', () => {
	it('resolves the dashboard lowercase and interview uppercase codes alike', () => {
		expect(toLang('da')).toBe('DA');
		expect(toLang('DA')).toBe('DA');
	});

	it.each(['JA', '', null, undefined])('falls back to English for %s', (code) => {
		expect(toLang(code)).toBe('EN');
	});
});

describe('welcome notice', () => {
	it.each(LANGS)('has one place for the contact address in %s', (lang) => {
		const { withdraw } = getUiText(lang).welcome;

		expect(withdraw.split('{email}')).toHaveLength(2);
	});

	it('splits around the address', () => {
		expect(splitWithdraw('Contact {email} now')).toEqual(['Contact ', ' now']);
	});
});

describe('reviewed UI copy', () => {
	it.each([
		['EN', 'You cannot continue this interview from where you left off.'],
		['DA', 'Du kan ikke fortsætte interviewet, hvor du slap.'],
		[
			'DE',
			'Sie können dieses Interview nicht an der Stelle fortsetzen, an der Sie aufgehört haben.'
		],
		['ES', 'No puedes continuar esta entrevista desde donde la dejaste.'],
		['FR', "Vous ne pouvez pas reprendre cet entretien là où vous l'avez laissé."]
	] as const)(
		'describes an expired session as an interview that cannot continue in %s',
		(lang, ending) => {
			expect(getUiText(lang).connection.expired_text).toContain(ending);
		}
	);

	it('uses formal German and complete French labels', () => {
		expect(getUiText('DE').survey.chooseOne).toBe('Wählen Sie eine Option');
		expect(getUiText('DE').grid.rateEach).toBe('Bewerten Sie jede Aussage');
		expect(getUiText('FR').survey.selectMultiple).toBe('Sélectionnez plusieurs options');
		expect(getUiText('FR').grid.rateEach).toBe('Évaluez chaque élément');
	});
});
