import type {
	Condition,
	ConditionEvaluation,
	Conditions,
	InterviewGuide,
	ItemDistribution
} from '$lib/api/types.gen';

/**
 * Reading a guide's conditions, wherever answers to them are shown.
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
 *
 * Three of the four actions are worded as a skip, and a card that states when
 * it was *not* asked leaves the reader to invert the rule themselves -- twice
 * over when the condition is itself negated ("Not asked when 5.1 is not
 * 'Never'"). Those summaries therefore state the negation of the authored
 * rule: each condition's polarity flips and the operators joining them swap
 * (De Morgan), which is the same rule read from the other side.
 *
 * A question can also condition on its own answer, which is how an author says
 * "stop here once they say they have nothing to add". That rule cannot decide
 * whether the question was asked -- it is read from the answer, so the question
 * was -- and stating it that way is circular ("Asked when 6.1 is not about
 * ..."). Such a rule is therefore left unflipped, says what it actually ends,
 * and calls its trigger "this answer" rather than pointing the reader at the
 * card they are already on.
 *
 * In `$lib` rather than beside the report page because the same sentence is
 * owed to a reader of a transcript: a question that was skipped is a hole they
 * can see and cannot explain, and one that was asked conditionally looks
 * exactly like one that was asked of everybody.
 */

/** The question a condition reads, by its position in the guide. */
export type ConditionRef = { section: number; question: number };

export type ConditionSummary = {
	/** The rule in one line, e.g. `Asked when 1.2 is "Yes"`. */
	text: string;
	/** The questions the rule reads, in the order it reads them. */
	refs: ConditionRef[];
	/**
	 * What the interview did on the occasions this rule was met, past tense and
	 * ready to follow a count, e.g. `moved on`.
	 *
	 * Only set for a rule read off the question's own answer. Any other rule
	 * decides whether the question was put at all, which the card already says
	 * as a share of the cohort it let through.
	 */
	outcome: string | null;
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
	skip_question: 'Asked when',
	skip_probes: 'Probed when',
	skip_section: 'Section asked when',
	end_interview: 'Interview ends when'
};

/**
 * The prefix for a rule that reads only this question's own answer.
 *
 * Stated forwards, and in terms of what it stops rather than what it allows:
 * the question has already been put by the time the rule can be evaluated, so
 * the only thing left for it to decide is how much further the interview goes.
 */
const SELF_ACTION_PREFIX: Record<Conditions['action'], string> = {
	skip_question: 'Moves on when',
	skip_probes: 'Not probed further when',
	skip_section: 'Section ends when',
	end_interview: 'Interview ends when'
};

/**
 * What firing did, for the count beside a rule read off its own answer.
 *
 * Past tense and agreeing with the prefix above, so the line reads as one
 * sentence: "Moves on when this answer is about X · 14% (12) moved on".
 */
const SELF_ACTION_OUTCOME: Record<Conditions['action'], string> = {
	skip_question: 'moved on',
	skip_probes: 'stopped the probes',
	skip_section: 'ended the section',
	end_interview: 'ended the interview'
};

/**
 * Whether the prefix above states the *opposite* of the authored rule.
 *
 * Ending the interview is the one action with nothing to invert: it is not a
 * statement about whether this question was put, and "Interview continues
 * when" is not what the author wrote down.
 */
const ACTION_NEGATES: Record<Conditions['action'], boolean> = {
	skip_question: true,
	skip_probes: true,
	skip_section: true,
	end_interview: false
};

// "Skips" is also what a participant does mid-interview, and the answer rate
// bar beside this line already counts those; the gating verb is kept clear of
// it.
const ACTION_GATE_VERB: Record<Conditions['action'], string> = {
	skip_question: 'gates',
	skip_probes: 'gates the probes on',
	skip_section: 'gates the section of',
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

/** The operator that joins the negation of two clauses joined by this one. */
function negateOperator(operator: 'AND' | 'OR' | null | undefined): 'AND' | 'OR' {
	return (operator ?? 'AND') === 'AND' ? 'OR' : 'AND';
}

/** Whether a condition reads the answer to the question that carries it. */
function readsSelf(condition: Condition, self: ConditionRef | undefined): boolean {
	return (
		self !== undefined &&
		condition.question_context.section === self.section &&
		condition.question_context.question === self.question
	);
}

function describeCondition(
	condition: Condition,
	negate: boolean,
	self: ConditionRef | undefined
): string {
	const classifying = condition.trigger_type === 'classification';
	// A number that links back to the card the reader is on is a dead end, and
	// reads as a different question besides.
	const target = readsSelf(condition, self)
		? 'this answer'
		: questionNumber(condition.question_context.section, condition.question_context.question);

	// The condition's own polarity, read from whichever side the prefix states.
	const negated = negate ? !condition.negated : condition.negated;

	const verb = classifying ? (negated ? 'is not about' : 'is about') : negated ? 'is not' : 'is';

	const values = join(
		condition.evaluation.map((evaluation) => describeEvaluation(evaluation, classifying)),
		condition.evaluation.map((evaluation) => evaluation.combine_next)
	);

	return `${target} ${verb} ${values}`;
}

/**
 * The rule on a question, or `null` when it has none to state.
 *
 * `self` is the question carrying the rule, when the caller knows it; passing
 * it is what lets a rule read off the question's own answer be told apart from
 * one read off somebody else's.
 */
export function summarizeConditions(
	conditions: Conditions | null | undefined,
	self?: ConditionRef
): ConditionSummary | null {
	if (!conditions || conditions.conditions.length === 0) return null;

	// Only a rule that reads nothing *but* its own answer gets the forward
	// wording: one that also reads another question still decides whether this
	// one was put, and the reader needs it said that way.
	const selfOnly = conditions.conditions.every((condition) => readsSelf(condition, self));
	const negate = !selfOnly && (ACTION_NEGATES[conditions.action] ?? false);

	const text = join(
		conditions.conditions.map((condition) => describeCondition(condition, negate, self)),
		conditions.conditions.map((condition) =>
			negate ? negateOperator(condition.combine_next) : condition.combine_next
		)
	);

	const prefix = selfOnly
		? (SELF_ACTION_PREFIX[conditions.action] ?? 'Applies when')
		: (ACTION_PREFIX[conditions.action] ?? 'Applies when');

	return {
		text: `${prefix} ${text}`,
		// Self-references are spelled "this answer" and have no number to link.
		refs: conditions.conditions
			.filter((condition) => !readsSelf(condition, self))
			.map((condition) => ({
				section: condition.question_context.section,
				question: condition.question_context.question
			})),
		outcome: selfOnly ? (SELF_ACTION_OUTCOME[conditions.action] ?? 'applied') : null
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
			// A question gating itself is not a relationship between two cards;
			// it is one card's own rule, and its summary already states it.
			if (readsSelf(condition, { section: item.section, question: item.main_question })) continue;

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

/** The gate line for a question that decides others, e.g. `gates 2.3, 2.4`. */
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

/**
 * Every condition in a guide, keyed by the question that carries it.
 *
 * Read off the guide rather than off the interview, so it says what the rule
 * *is* and not merely that something happened. The draft guide is used, which
 * is an approximation: interviews ran against per-interview snapshots, so a
 * condition edited since is described as it reads now. The report page makes
 * the same trade, for the same reason -- the alternative is a guide per
 * interview on screen at once.
 */
export function guideConditions(
	guide: InterviewGuide | null | undefined
): Map<string, ConditionSummary> {
	const summaries = new Map<string, ConditionSummary>();
	if (!guide) return summaries;

	guide.question_sections?.forEach((section, sectionIndex) => {
		section.questions?.forEach((question, questionIndex) => {
			const summary = summarizeConditions(question.conditions, {
				section: sectionIndex,
				question: questionIndex
			});
			if (summary) summaries.set(questionKey(sectionIndex, questionIndex), summary);
		});
	});

	return summaries;
}
