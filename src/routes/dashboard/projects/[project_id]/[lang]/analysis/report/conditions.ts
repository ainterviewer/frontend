import type {
	Condition,
	ConditionEvaluation,
	Conditions,
	ItemDistribution
} from '$lib/api/types.gen';

/**
 * Reading a guide's conditions off the report page.
 *
 * A conditional question is the one place where the cards on this page are not
 * independent: its numbers describe a subset of the cohort chosen by an answer
 * given somewhere else, and a reader comparing it against an unconditional
 * question next to it is comparing two different groups of people. The
 * relationship therefore has to be stated on both cards -- on the gated one,
 * what had to be true; on the gating one, what it decides -- so neither can be
 * read in isolation without noticing.
 *
 * The action fires when the conditions are *met* (see the guide editor's
 * "Action when conditions are met"), so the summaries are worded as "when",
 * not as "only if".
 */

/** The question a condition reads, by its position in the guide. */
export type ConditionRef = { section: number; question: number };

export type ConditionSummary = {
	/** The rule in one line, e.g. `Not asked when 1.2 is "Yes"`. */
	text: string;
	/** The questions the rule reads, in the order it reads them. */
	refs: ConditionRef[];
};

/** What one question's conditions do to the questions they gate. */
export type Gate = ConditionRef & { action: Conditions['action'] };

export function questionKey(section: number, question: number): string {
	return `${section}-${question}`;
}

/** How a question is referred to on this page: its position, not its wording. */
export function questionNumber(section: number, question: number): string {
	return `${section + 1}.${question + 1}`;
}

const ACTION_PREFIX: Record<Conditions['action'], string> = {
	skip_question: 'Not asked when',
	skip_probes: 'Not probed when',
	skip_section: 'Section skipped when',
	end_interview: 'Interview ends when'
};

const ACTION_GATE_VERB: Record<Conditions['action'], string> = {
	skip_question: 'skips',
	skip_probes: 'stops the probes on',
	skip_section: 'skips the section of',
	end_interview: 'can end the interview at'
};

// Spelled out rather than left as symbols: the summary is a sentence, and
// "is < 18" is not one.
const COMPARISONS: Record<string, string> = {
	'<': 'less than',
	'<=': 'at most',
	'>': 'more than',
	'>=': 'at least'
};

function describeEvaluation(evaluation: ConditionEvaluation, classifying: boolean): string {
	const value = String(evaluation.trigger_value);

	// A classification trigger is a description of an answer rather than a
	// value to match, so it is quoted as prose and never given an operator.
	if (classifying) return `“${value}”`;

	const operator = evaluation.comparison_operator ?? '==';
	return operator === '==' ? `“${value}”` : `${COMPARISONS[operator]} ${value}`;
}

function join(parts: string[], operators: (string | null | undefined)[]): string {
	return parts.reduce((text, part, index) => {
		if (index === 0) return part;
		// The guide requires an operator on every element but the last; a
		// half-authored condition falls back to "and" rather than to a sentence
		// with two clauses jammed together.
		const operator = (operators[index - 1] ?? 'AND').toLowerCase();
		return `${text} ${operator} ${part}`;
	}, '');
}

function describeCondition(condition: Condition): string {
	const classifying = condition.trigger_type === 'classification';
	const target = questionNumber(
		condition.question_context.section,
		condition.question_context.question
	);

	const verb = classifying
		? condition.negated
			? 'is not about'
			: 'is about'
		: condition.negated
			? 'is not'
			: 'is';

	const values = join(
		condition.evaluation.map((evaluation) => describeEvaluation(evaluation, classifying)),
		condition.evaluation.map((evaluation) => evaluation.combine_next)
	);

	return `${target} ${verb} ${values}`;
}

/** The rule on a question, or `null` when it has none to state. */
export function summarizeConditions(
	conditions: Conditions | null | undefined
): ConditionSummary | null {
	if (!conditions || conditions.conditions.length === 0) return null;

	const text = join(
		conditions.conditions.map(describeCondition),
		conditions.conditions.map((condition) => condition.combine_next)
	);

	return {
		text: `${ACTION_PREFIX[conditions.action] ?? 'Applies when'} ${text}`,
		refs: conditions.conditions.map((condition) => ({
			section: condition.question_context.section,
			question: condition.question_context.question
		}))
	};
}

/**
 * Which questions each answer decides, keyed by the answering question.
 *
 * Built by inverting every item's own conditions rather than stored anywhere:
 * the guide only ever records the dependency on the dependent side.
 */
export function buildGateMap(items: ItemDistribution[]): Map<string, Gate[]> {
	const gates = new Map<string, Gate[]>();

	for (const item of items) {
		const conditions = item.conditions;
		if (!conditions) continue;

		for (const condition of conditions.conditions) {
			const key = questionKey(
				condition.question_context.section,
				condition.question_context.question
			);
			const gate: Gate = {
				section: item.section,
				question: item.main_question,
				action: conditions.action
			};

			const existing = gates.get(key);
			// A question can appear in several of another's conditions ("A and
			// A" is authorable); it is one relationship either way.
			if (!existing) gates.set(key, [gate]);
			else if (!existing.some((g) => g.section === gate.section && g.question === gate.question))
				existing.push(gate);
		}
	}

	return gates;
}

/** The gate line for a question that decides others, e.g. `skips 2.3, 2.4`. */
export function describeGates(gates: Gate[]): string {
	// Grouped by what the answer does, so a question that both skips one
	// question and ends the interview says both rather than lumping them.
	const byAction = new Map<Conditions['action'], string[]>();
	for (const gate of gates) {
		const numbers = byAction.get(gate.action) ?? [];
		numbers.push(questionNumber(gate.section, gate.question));
		byAction.set(gate.action, numbers);
	}

	return [...byAction.entries()]
		.map(([action, numbers]) => `${ACTION_GATE_VERB[action] ?? 'affects'} ${numbers.join(', ')}`)
		.join(' · ');
}
