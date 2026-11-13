// What changed between two versions of a project's content, read in one
// language: for the compare view in the version history.
//
// Sections, questions, options and grid rows are matched by id, as the
// backend's app/db/versioning.py does to number a publish, so a reworded
// question is "changed" rather than removed and added. Everything else is
// flattened to labelled leaves and compared leaf by leaf.

import { diffArrays, diffWordsWithSpace } from 'diff';

import type {
	ContentDraftPublic,
	LocalizedQuestion,
	LocalizedQuestionSection
} from '$lib/api/types.gen';

import { AGENT_LABEL, SURVEY_LABEL } from './labels';

/** What a version and the draft both hold. */
export type Content = Omit<ContentDraftPublic, 'revision'>;

export type Status = 'added' | 'removed' | 'changed' | 'same';

/** One labelled value, before and after. */
export type Change = {
	/** Where it is, stable across both sides (ids, not positions). */
	key: string;
	label: string;
	status: Status;
	/** Null when that side does not have it. */
	before: string | null;
	after: string | null;
	/** Prose, shown as a word diff, rather than a value shown as before → after. */
	prose: boolean;
	/** Too technical to show (conditions, media data): only that it changed. */
	opaque: boolean;
};

export type QuestionDiff = {
	id: string;
	status: Status;
	/** To another section, or out of order with the questions around it. */
	moved: boolean;
	/** The section it was in, numbered as before, when it changed section. */
	fromSection: number | null;
	changes: Change[];
};

export type SectionDiff = {
	id: string;
	status: Status;
	moved: boolean;
	/** Numbered as after; as before for a removed section. */
	number: number;
	changes: Change[];
	questions: QuestionDiff[];
};

export type ContentDiff = {
	/** Guide-wide text and settings: framing, introduction, outros, ... */
	guide: Change[];
	sections: SectionDiff[];
	consent: Change[];
	welcome: Change[];
	emails: Change[];
	agents: Change[];
	languages: Change[];
};

type Side = {
	/** The language read, and the one used where it has no text. */
	lang: string;
	fallback: string;
	/** Every language code either side knows: what makes an object a text. */
	codes: Set<string>;
};

type Leaf = { label: string; value: string; prose: boolean; opaque: boolean };

const LABELS: Record<string, string> = {
	// Guide
	framing: 'Framing',
	introduction: 'Introduction',
	outro: 'Outro',
	alt_outro: 'Outro when ended early',
	extra_variables: 'Extra variables',
	timed_messages: 'Timed messages',
	message: 'Message',
	time: 'After (seconds)',
	include_in_history: 'Included in history',
	as_modal: 'Shown as a pop-up',
	// Sections and questions
	description: 'Description',
	shuffle: 'Shuffled',
	main_question: 'Question',
	probes: 'Probes',
	alternative_main_questions: 'Alternative phrasings',
	max_probes_n: 'Max probes',
	max_probes_time: 'Max probing time',
	survey_item: 'Survey',
	type: 'Type',
	required: 'Required',
	options: 'Options',
	rows: 'Rows',
	with_other: 'With an "Other" option',
	shuffle_options: 'Shuffled options',
	ui: 'Shown as',
	min: 'Min',
	max: 'Max',
	step: 'Step',
	min_label: 'Min label',
	max_label: 'Max label',
	can_answer: 'Can answer questions',
	check_if_answered: 'Check if already answered',
	check_if_exhausted: 'Check if exhausted',
	can_skip: 'Can be skipped',
	create_segue: 'Transition from the previous question',
	exclude_from_history: 'Excluded from history',
	references: 'Refers to earlier answers',
	image: 'Media',
	name: 'File',
	data: 'File',
	primer: 'Primer',
	alt: 'Alt text',
	user_image: 'Respondent uploads an image',
	conditions: 'Conditions',
	probing_context: 'Probing context',
	// Consent, welcome, emails
	title: 'Title',
	text: 'Text',
	email: 'Contact email',
	video_file_name: 'Video',
	with_id: 'Asks for an ID',
	invite: 'Invitation',
	reminder: 'Reminder',
	subject: 'Subject',
	template: 'Body',
	// Agents
	...AGENT_LABEL,
	model: 'Model',
	temperature: 'Temperature',
	include: 'On',
	prompt_slots: 'Prompt',
	persona: 'Persona',
	question_qualities: 'Question qualities',
	guidelines: 'Additional guidelines',
	instructions: 'Probing instructions',
	few_shot_examples: 'Few-shot examples',
	// Languages
	languages: 'Languages',
	default_language: 'Default language',
	languages_in_progress: 'In progress'
};

/** What an item of a list is called, numbered: "Option 2". */
const ITEM_LABELS: Record<string, string> = {
	options: 'Option',
	rows: 'Row',
	timed_messages: 'Message',
	conditions: 'Condition'
};

/** Bookkeeping, not content. */
const SKIPPED = new Set(['id', 'ai_generated_sections', 'ai_generated_questions']);

/** Shown only as "changed": ids and encoded files mean nothing to read. */
const OPAQUE = new Set(['conditions', 'references', 'data']);

const VALUE_LABELS: Record<string, Record<string, string>> = {
	type: SURVEY_LABEL
};

function humanize(key: string): string {
	// Names like template paths are shown as they are.
	if (!/^[a-z_]+$/.test(key)) return key;
	const words = key.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, side: Side): value is Record<string, string> {
	if (!isRecord(value)) return false;
	const keys = Object.keys(value);
	return (
		keys.length > 0 &&
		keys.every((k) => side.codes.has(k) && (typeof value[k] === 'string' || value[k] == null))
	);
}

/** The text as respondents in `side.lang` get it. */
function read(text: Record<string, string>, side: Side): string {
	return text[side.lang] || text[side.fallback] || '';
}

function scalar(value: unknown, key: string): string {
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	const text = String(value);
	return VALUE_LABELS[key]?.[text] ?? text;
}

function isProse(value: string): boolean {
	return value.length > 80 || value.includes('\n');
}

/** Every leaf under `value`, keyed by its path. */
function flatten(
	value: unknown,
	side: Side,
	key: string,
	path: string,
	label: string[],
	out: Map<string, Leaf>
): Map<string, Leaf> {
	if (value == null || value === '') return out;
	const name = label.filter(Boolean).join(' › ');

	if (OPAQUE.has(key)) {
		out.set(path, { label: name, value: JSON.stringify(value), prose: false, opaque: true });
		return out;
	}
	if (isText(value, side)) {
		const text = read(value, side);
		if (text) out.set(path, { label: name, value: text, prose: true, opaque: false });
		return out;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return out;
		// A list of words or texts reads as one text, a line each.
		if (value.every((v) => !isRecord(v) || isText(v, side))) {
			const lines = value.map((v) =>
				isRecord(v) ? read(v as Record<string, string>, side) : scalar(v, key)
			);
			const prose = value.some((v) => isRecord(v)) || lines.some(isProse);
			out.set(path, {
				label: name,
				value: lines.join(prose ? '\n' : ', '),
				prose,
				opaque: false
			});
			return out;
		}
		// "Option 2" stands in for the list's own name: not "Options › Option 2".
		const listLabel = label.slice(0, -1);
		value.forEach((item, i) => {
			const id = isRecord(item) && typeof item.id === 'string' ? item.id : String(i);
			const itemLabel = `${ITEM_LABELS[key] ?? humanize(key)} ${i + 1}`;
			// An option's only text is the option: "Option 2", not "Option 2 › Text".
			if (isRecord(item)) {
				for (const [k, v] of Object.entries(item)) {
					if (SKIPPED.has(k)) continue;
					const childLabel = k === 'text' ? [] : [LABELS[k] ?? humanize(k)];
					flatten(v, side, k, `${path}/${id}/${k}`, [...listLabel, itemLabel, ...childLabel], out);
				}
			} else {
				flatten(item, side, key, `${path}/${id}`, [...listLabel, itemLabel], out);
			}
		});
		return out;
	}
	if (isRecord(value)) {
		for (const [k, v] of Object.entries(value)) {
			if (SKIPPED.has(k)) continue;
			flatten(v, side, k, path ? `${path}/${k}` : k, [...label, LABELS[k] ?? humanize(k)], out);
		}
		return out;
	}
	const text = scalar(value, key);
	out.set(path, { label: name, value: text, prose: isProse(text), opaque: false });
	return out;
}

/**
 * `after`'s order, with what only `before` has put back after whatever
 * preceded it there.
 */
export function mergeOrder(before: string[], after: string[]): string[] {
	const inAfter = new Set(after);
	const result = [...after];
	let anchor = -1;
	for (const key of before) {
		if (inAfter.has(key)) {
			anchor = result.indexOf(key);
		} else {
			result.splice(anchor + 1, 0, key);
			anchor++;
		}
	}
	return result;
}

/**
 * Of the keys both lists have, those out of order: not on the longest run
 * that kept its order. Adding or removing items around one does not move it.
 */
export function movedKeys(before: string[], after: string[]): Set<string> {
	const position = new Map(before.map((k, i) => [k, i]));
	const common = after.filter((k) => position.has(k));
	const seq = common.map((k) => position.get(k)!);
	// Longest increasing subsequence, patience sorting.
	const tails: number[] = [];
	const prev: number[] = new Array(seq.length).fill(-1);
	for (let i = 0; i < seq.length; i++) {
		let lo = 0;
		let hi = tails.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (seq[tails[mid]] < seq[i]) lo = mid + 1;
			else hi = mid;
		}
		if (lo > 0) prev[i] = tails[lo - 1];
		tails[lo] = i;
	}
	const kept = new Set<string>();
	for (let i = tails.at(-1) ?? -1; i >= 0; i = prev[i]) kept.add(common[i]);
	return new Set(common.filter((k) => !kept.has(k)));
}

function compareLeaves(before: Map<string, Leaf>, after: Map<string, Leaf>): Change[] {
	return mergeOrder([...before.keys()], [...after.keys()]).map((key) => {
		const b = before.get(key);
		const a = after.get(key);
		const status: Status = !b ? 'added' : !a ? 'removed' : b.value === a.value ? 'same' : 'changed';
		return {
			key,
			label: (a ?? b)!.label,
			status,
			before: b?.value ?? null,
			after: a?.value ?? null,
			prose: !!(a?.prose || b?.prose),
			opaque: !!(a?.opaque || b?.opaque)
		};
	});
}

function compare(
	before: unknown,
	after: unknown,
	sides: [Side, Side],
	options: { exclude?: string[]; label?: string[]; key?: string } = {}
): Change[] {
	const strip = (value: unknown) =>
		isRecord(value) && options.exclude
			? Object.fromEntries(Object.entries(value).filter(([k]) => !options.exclude!.includes(k)))
			: value;
	const key = options.key ?? '';
	const label = options.label ?? [];
	return compareLeaves(
		flatten(strip(before), sides[0], key, key, label, new Map()),
		flatten(strip(after), sides[1], key, key, label, new Map())
	);
}

function statusOf(present: [boolean, boolean], changes: Change[]): Status {
	if (!present[0]) return 'added';
	if (!present[1]) return 'removed';
	return changes.some((c) => c.status !== 'same') ? 'changed' : 'same';
}

function idOf(item: { id?: string }, fallback: string): string {
	return item.id ?? fallback;
}

function diffSections(before: Content, after: Content, sides: [Side, Side]): SectionDiff[] {
	const oldSections = before.guide.question_sections ?? [];
	const newSections = after.guide.question_sections ?? [];
	const sectionIds = (sections: LocalizedQuestionSection[]) =>
		sections.map((s, i) => idOf(s, `section-${i}`));
	const oldIds = sectionIds(oldSections);
	const newIds = sectionIds(newSections);
	const oldById = new Map(oldSections.map((s, i) => [oldIds[i], s]));
	const newById = new Map(newSections.map((s, i) => [newIds[i], s]));

	// Where each question is, by id, on each side.
	type Place = { section: string; question: LocalizedQuestion };
	const places = (sections: LocalizedQuestionSection[], ids: string[]) =>
		new Map<string, Place>(
			sections.flatMap((s, i) =>
				(s.questions ?? []).map(
					(q, j) => [idOf(q, `${ids[i]}-q${j}`), { section: ids[i], question: q }] as const
				)
			)
		);
	const oldPlaces = places(oldSections, oldIds);
	const newPlaces = places(newSections, newIds);
	const questionIds = (section: LocalizedQuestionSection | undefined, id: string) =>
		(section?.questions ?? []).map((q, j) => idOf(q, `${id}-q${j}`));

	const movedSections = movedKeys(oldIds, newIds);

	return mergeOrder(oldIds, newIds).map((id) => {
		const old = oldById.get(id);
		const now = newById.get(id);
		const changes = compare(old, now, sides, { exclude: ['questions'] });

		// Questions here before that are not elsewhere now, and those here now.
		const oldQuestions = questionIds(old, id).filter((q) => {
			const place = newPlaces.get(q);
			return !place || place.section === id;
		});
		const newQuestions = questionIds(now, id);
		const reordered = movedKeys(
			oldQuestions.filter((q) => newPlaces.get(q)?.section === id),
			newQuestions.filter((q) => oldPlaces.get(q)?.section === id)
		);

		const questions = mergeOrder(oldQuestions, newQuestions).map((qid): QuestionDiff => {
			const was = oldPlaces.get(qid);
			const is = newPlaces.get(qid);
			const qChanges = compare(was?.question, is?.question, sides);
			const changedSection = !!was && !!is && was.section !== is.section;
			return {
				id: qid,
				status: statusOf([!!was, !!is], qChanges),
				moved: changedSection || reordered.has(qid),
				fromSection: changedSection ? oldIds.indexOf(was!.section) + 1 : null,
				changes: qChanges
			};
		});

		const status = statusOf([!!old, !!now], changes);
		return {
			id,
			status,
			moved: movedSections.has(id),
			number: now ? newIds.indexOf(id) + 1 : oldIds.indexOf(id) + 1,
			changes,
			questions
		};
	});
}

/** What changed from `before` to `after`, read in `lang`. */
export function diffContent(before: Content, after: Content, lang: string): ContentDiff {
	const codes = new Set([...before.languages, ...after.languages]);
	const sides: [Side, Side] = [
		{ lang, fallback: before.default_language, codes },
		{ lang, fallback: after.default_language, codes }
	];
	const pick = (content: Content, keys: (keyof Content)[]) =>
		Object.fromEntries(keys.map((k) => [k, content[k]]));
	const languageKeys: (keyof Content)[] = [
		'languages',
		'default_language',
		'languages_in_progress'
	];

	return {
		guide: compare(before.guide, after.guide, sides, { exclude: ['question_sections'] }),
		sections: diffSections(before, after, sides),
		consent: compare(before.consent, after.consent, sides),
		welcome: compare(before.welcome, after.welcome, sides),
		emails: compare(before.emails, after.emails, sides),
		agents: [
			...compare(before.agent_configs, after.agent_configs, sides),
			...compare(before.prompt_overrides, after.prompt_overrides, sides, {
				key: 'prompt_overrides',
				label: ['Template override']
			})
		],
		languages: compare(pick(before, languageKeys), pick(after, languageKeys), sides)
	};
}

export function isChanged(item: { status: Status; moved?: boolean }): boolean {
	return item.status !== 'same' || !!item.moved;
}

/** How many things changed in the guide: its own fields, sections and questions. */
export function guideChangeCount(diff: ContentDiff): number {
	return (
		diff.guide.filter(isChanged).length +
		diff.sections.reduce(
			(n, s) => n + (isChanged(s) ? 1 : 0) + s.questions.filter(isChanged).length,
			0
		)
	);
}

/**
 * Markup as the text it reads as, for a word diff: guide text carries inline
 * tags and email bodies are HTML.
 */
export function plainText(markup: string): string {
	return markup
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** A run of prose text, as in both versions, or only before or after. */
export type Segment = {
	kind: 'same' | 'removed' | 'added';
	text: string;
	/** Whole lines replaced by others: shown on lines of their own. */
	block?: boolean;
};

export type ProseDiff = {
	parts: Segment[];
	/**
	 * Too little is left of the old text for a diff to read: the compare view
	 * shows the new text, with the old one on request.
	 */
	rewritten: boolean;
};

/**
 * Changed lines get a word diff when at least this share of their text is
 * kept, or when the edits are few enough to read (one per line at most).
 * Otherwise they show as the old lines, then the new.
 */
const LINES_KEPT = 0.5;
/** Below this share of text kept, the whole value counts as rewritten. */
const TEXT_KEPT = 0.1;

const letters = (text: string) => text.replace(/\s/g, '').length;

/** How much of the longer side the unchanged parts make up, from 0 to 1. */
function kept(parts: Segment[]): number {
	let same = 0;
	let before = 0;
	let after = 0;
	for (const p of parts) {
		const n = letters(p.text);
		if (p.kind !== 'added') before += n;
		if (p.kind !== 'removed') after += n;
		if (p.kind === 'same') same += n;
	}
	const longer = Math.max(before, after);
	return longer ? same / longer : 1;
}

/**
 * A word or two left in place between two edits ("og", "i", a comma) is
 * counted as removed and added, so the edits read as one phrase replaced by
 * another instead of alternating fragments.
 */
function joinEdits(parts: Segment[]): Segment[] {
	const out: Segment[] = [];
	let removed = '';
	let added = '';
	const flush = () => {
		if (removed) out.push({ kind: 'removed', text: removed });
		if (added) out.push({ kind: 'added', text: added });
		removed = added = '';
	};
	parts.forEach((p, i) => {
		if (p.kind === 'removed') removed += p.text;
		else if (p.kind === 'added') added += p.text;
		else if ((removed || added) && i < parts.length - 1 && isSmall(p.text)) {
			removed += p.text;
			added += p.text;
		} else {
			flush();
			out.push(p);
		}
	});
	flush();
	return out;
}

/** How many separate places the text was edited in. */
function edits(parts: Segment[]): number {
	return parts.filter((p, i) => p.kind !== 'same' && (i === 0 || parts[i - 1].kind === 'same'))
		.length;
}

function isSmall(text: string): boolean {
	const words = text.trim().split(/\s+/).filter(Boolean);
	return words.length <= 2 && text.trim().length <= 12;
}

function words(before: string, after: string): Segment[] {
	return joinEdits(
		diffWordsWithSpace(before, after).map((p) => ({
			kind: p.added ? 'added' : p.removed ? 'removed' : 'same',
			text: p.value
		}))
	);
}

function push(out: Segment[], kind: Segment['kind'], text: string) {
	if (!text) return;
	const last = out.at(-1);
	if (last?.kind === kind && !last.block) last.text += text;
	else out.push({ kind, text });
}

/**
 * A readable diff of two texts. Lines are matched first; where lines changed,
 * a word diff is shown when enough of them is kept, and otherwise the old
 * lines followed by the new ones.
 */
export function diffProse(before: string, after: string): ProseDiff {
	const out: Segment[] = [];
	let removed: string[] = [];
	let added: string[] = [];

	// Every block ends its last line. Old lines replaced by new ones each end
	// their own, so each side reads back with its own line breaks.
	const flush = () => {
		if (!removed.length && !added.length) return;
		const old = removed.join('\n');
		const now = added.join('\n');
		const inline = old && now ? words(old, now) : [];
		const share = inline.length ? kept(inline) : 0;
		const readable =
			share >= LINES_KEPT || (share > 0 && edits(inline) <= Math.max(removed.length, added.length));
		if (readable) {
			for (const p of inline) push(out, p.kind, p.text);
			push(out, 'same', '\n');
		} else {
			if (removed.length) out.push({ kind: 'removed', text: old + '\n', block: true });
			if (added.length) out.push({ kind: 'added', text: now + '\n', block: true });
		}
		removed = [];
		added = [];
	};

	const lines = (text: string) => (text ? text.split('\n') : []);
	for (const run of diffArrays(lines(before), lines(after))) {
		if (run.removed) removed.push(...run.value);
		else if (run.added) added.push(...run.value);
		else {
			flush();
			push(out, 'same', run.value.join('\n') + '\n');
		}
	}
	flush();

	// The last line on each side has no line break after it.
	const lastBefore = out.findLast((p) => p.kind !== 'added');
	const lastAfter = out.findLast((p) => p.kind !== 'removed');
	for (const p of new Set([lastBefore, lastAfter])) if (p) p.text = p.text.slice(0, -1);
	const parts = out.filter((p) => p.text);

	return {
		parts,
		rewritten: letters(before) > 0 && letters(after) > 0 && kept(parts) < TEXT_KEPT
	};
}
