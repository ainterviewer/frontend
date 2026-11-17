import { describe, expect, it } from 'vitest';

import type { ComparisonInterview, RunComparison } from '$lib/api/types.gen';

import { pairInterviews, personaSummary, runStats } from './compare';

function interview(id: string, persona: string, turns: ComparisonInterview['turns'] = []) {
	return { interview_id: id, status: 'completed', persona, turns } as ComparisonInterview;
}

function run(interviews: ComparisonInterview[]) {
	return { run: {} as RunComparison['run'], interviews } as RunComparison;
}

describe('pairInterviews', () => {
	it('pairs interviews by persona, repeats by order', () => {
		const rows = pairInterviews([
			run([interview('a1', 'nurse'), interview('a2', 'nurse'), interview('a3', 'pilot')]),
			run([interview('b1', 'pilot'), interview('b2', 'nurse')])
		]);
		expect(rows.map((r) => r.interviews.map((i) => i?.interview_id ?? null))).toEqual([
			['a1', 'b2'],
			['a2', null],
			['a3', 'b1']
		]);
	});
});

describe('personaSummary', () => {
	it('shortens a generated persona', () => {
		expect(personaSummary('a nurse')).toBe('a nurse');
		expect(personaSummary(null)).toBe('Unknown interviewee');
		expect(personaSummary({ name: 'Alice', age: 40, occupation: 'Farmer' } as never)).toBe(
			'Alice, 40, Farmer'
		);
	});
});

describe('runStats', () => {
	it('counts questions, follow-ups and words', () => {
		const stats = runStats(
			run([
				interview('a', 'x', [
					{ role: 'assistant', content: 'How are you today?', main_question: 0, sub_question: 0 },
					{ role: 'user', content: 'Fine' },
					{ role: 'assistant', content: 'Why?', main_question: 0, sub_question: 1 }
				])
			])
		);
		expect(stats).toEqual({
			interviews: 1,
			completed: 1,
			questions: 1,
			followUps: 1,
			wordsPerMessage: 2.5
		});
	});
});
