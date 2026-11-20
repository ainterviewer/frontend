import { describe, expect, it } from 'vitest';

import type { Condition, ConditionBlock, ItemDistribution } from '$lib/api/types.gen';

import { buildGateMap, combineSummaries, questionKey, summarizeConditions } from './conditions';

// A question may carry several conditions, each with its own action: each is
// stated on its own, and a question gating another through two of them gates
// it once per action.

function block(section: number, question: number, value: string): ConditionBlock {
	return {
		question_context: {
			question_index: [section, question],
			question_id: `q-${section}-${question}`,
			part: 'main'
		},
		evaluation: [{ trigger_value: value, comparison_operator: '==' }],
		trigger_type: 'match'
	};
}

const SKIP_SECTION: Condition = {
	id: 'skip-section',
	action: 'skip_section',
	blocks: [block(0, 0, 'No')]
};
const SKIP_PROBES: Condition = {
	id: 'skip-probes',
	action: 'skip_probes',
	blocks: [block(0, 0, 'Yes')]
};

describe('summarizeConditions', () => {
	it('states each condition apart, with its id', () => {
		const summaries = summarizeConditions([SKIP_SECTION, SKIP_PROBES], {
			section: 0,
			question: 1
		});

		expect(summaries.map(({ id }) => id)).toEqual(['skip-section', 'skip-probes']);
		expect(summaries[0].summary.text).not.toBe(summaries[1].summary.text);
	});

	it('states none for a question without conditions', () => {
		expect(summarizeConditions([], { section: 0, question: 1 })).toEqual([]);
		expect(summarizeConditions(undefined)).toEqual([]);
	});
});

describe('combineSummaries', () => {
	it('joins several into one line, a sentence each', () => {
		const summaries = summarizeConditions([SKIP_SECTION, SKIP_PROBES]).map((s) => s.summary);
		const combined = combineSummaries(summaries)!;

		expect(combined.text).toBe(`${summaries[0].text}; ${summaries[1].text}`);
		expect(combined.refs).toHaveLength(2);
		expect(combined.outcome).toBeNull();
	});

	it('is nothing for no conditions', () => {
		expect(combineSummaries([])).toBeNull();
	});
});

describe('buildGateMap', () => {
	it('gates once per action', () => {
		const item = {
			section: 0,
			main_question: 1,
			conditions: [SKIP_SECTION, SKIP_PROBES]
		} as ItemDistribution;

		const gates = buildGateMap([item]).get(questionKey(0, 0)) ?? [];

		expect(gates.map((gate) => gate.action)).toEqual(['skip_section', 'skip_probes']);
	});
});

describe('exclusive blocks', () => {
	const pets = (negated: boolean): Condition => ({
		id: 'pets',
		action: 'end_interview',
		blocks: [
			{
				...block(0, 0, 'Dog'),
				evaluation: [
					{ trigger_value: 'Dog', comparison_operator: '==', combine_next: 'AND' },
					{ trigger_value: 'Cat', comparison_operator: '==' }
				],
				exclusive: true,
				negated
			}
		]
	});

	it('say “only”', () => {
		const [{ summary }] = summarizeConditions([pets(false)], { section: 0, question: 1 });
		expect(summary.text).toBe('Interview ends when 1.1 is only “Dog” and “Cat”');
	});

	it('say "not only" when negated', () => {
		const [{ summary }] = summarizeConditions([pets(true)], { section: 0, question: 1 });
		expect(summary.text).toBe('Interview ends when 1.1 is not only “Dog” and “Cat”');
	});
});
