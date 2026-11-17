// Reading simulation runs side by side: the runs one request started on
// several interviewer models interviewed the same synthetic people, so their
// interviews pair up by persona (the backend's `compare_runs`).

import type {
	ComparisonInterview,
	InterviewSubjectOutput,
	RunComparison
} from '$lib/api/types.gen';

type Persona = ComparisonInterview['persona'];

/** One synthetic interviewee, and their interview in each run (null where a run has none). */
export type PairedRow = {
	key: string;
	persona: Persona;
	interviews: (ComparisonInterview | null)[];
};

function personaKey(persona: Persona): string {
	return typeof persona === 'string' ? persona : JSON.stringify(persona ?? null);
}

/** A persona in a line: a fixed persona's text, or a generated one's name, age and occupation. */
export function personaSummary(persona: Persona): string {
	if (persona == null) return 'Unknown interviewee';
	if (typeof persona === 'string') return persona;
	const subject = persona as InterviewSubjectOutput;
	return `${subject.name}, ${subject.age}, ${subject.occupation}`;
}

/**
 * Rows of interviews with the same persona across runs. A persona drawn more
 * than once (fixed personas repeat) pairs its first interview in each run,
 * then its second, and so on, in the order the runs started them.
 */
export function pairInterviews(runs: RunComparison[]): PairedRow[] {
	const rows: PairedRow[] = [];
	const byKey = new Map<string, PairedRow>();
	runs.forEach((run, column) => {
		const seen = new Map<string, number>();
		for (const interview of run.interviews) {
			const base = personaKey(interview.persona);
			const occurrence = seen.get(base) ?? 0;
			seen.set(base, occurrence + 1);
			const key = `${base}#${occurrence}`;
			let row = byKey.get(key);
			if (!row) {
				row = { key, persona: interview.persona, interviews: runs.map(() => null) };
				byKey.set(key, row);
				rows.push(row);
			}
			row.interviews[column] = interview;
		}
	});
	return rows;
}

export type RunStats = {
	interviews: number;
	completed: number;
	/** Per interview, on average. */
	questions: number;
	followUps: number;
	/** Words per interviewer message, on average. */
	wordsPerMessage: number;
};

function mean(values: number[]): number {
	return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** What a run's interviewer did, in figures that differ between models. */
export function runStats(run: RunComparison): RunStats {
	const interviewer = run.interviews.map((i) => i.turns.filter((t) => t.role === 'assistant'));
	return {
		interviews: run.interviews.length,
		completed: run.interviews.filter((i) => i.status === 'completed').length,
		// sub_question 0 or none is a main question; above 0, a probe.
		questions: mean(interviewer.map((turns) => turns.filter((t) => !t.sub_question).length)),
		followUps: mean(interviewer.map((turns) => turns.filter((t) => !!t.sub_question).length)),
		wordsPerMessage: mean(
			interviewer.flat().map((t) => t.content.split(/\s+/).filter(Boolean).length)
		)
	};
}
