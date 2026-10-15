import { generateKeyBetween } from 'fractional-indexing';
import * as Y from 'yjs';

import type { LocalizedInterviewGuide } from '$lib/api/types.gen';

// The guide as a Yjs document, mirroring the backend's
// `app/collab/guide_doc.py` key for key: the two must agree on the shape, or
// what one side writes the other cannot read. See that module for why the
// shape is what it is. In short:
//
// - every text is a `Y.Map` from language to `Y.Text`;
// - sections, questions and survey options are `Y.Map`s keyed by id, each
//   entry carrying an `order` key (fractional indexing); questions are flat,
//   with a `section_id`, so a move never loses a concurrent edit;
// - probes, alternative wordings and timed messages are `Y.Array`s;
// - every other value is JSON *text* -- never a bare number, which Yjs would
//   hand the server back as a float.
//
// Root keys: `meta` (`doc_id`), `guide`, `sections`, `questions`.

type Json = Record<string, unknown>;
type Texts = Record<string, string>;

export const ORDER = 'order';
export const SECTION_ID = 'section_id';

const GUIDE_TEXTS = ['framing', 'introduction', 'outro', 'alt_outro'];
const SECTION_TEXTS = ['description'];
const QUESTION_TEXTS = ['main_question', 'description'];
const QUESTION_TEXT_LISTS = ['probes', 'alternative_main_questions'];
const SURVEY_TEXTS = ['min_label', 'max_label'];
const IMAGE_TEXTS = ['primer', 'description', 'alt'];
const TIMED_TEXTS = ['message'];

export function roots(doc: Y.Doc) {
	return {
		meta: doc.getMap<unknown>('meta'),
		guide: doc.getMap<unknown>('guide'),
		sections: doc.getMap<unknown>('sections'),
		questions: doc.getMap<unknown>('questions')
	};
}

/** The doc's lineage; see the backend's `DOC_ID`. */
export function docId(doc: Y.Doc): string | null {
	const value = roots(doc).meta.get('doc_id');
	return typeof value === 'string' ? value : null;
}

// ---- Writing ---------------------------------------------------------------

/** Make `target` read `value`, touching only what differs: a common prefix
 * and suffix are kept, so remote carets and concurrent edits elsewhere in the
 * text survive. */
export function setText(target: Y.Text, value: string) {
	const current = target.toString();
	if (current === value) return;
	let start = 0;
	const limit = Math.min(current.length, value.length);
	while (start < limit && current[start] === value[start]) start++;
	let end = 0;
	while (
		end < limit - start &&
		current[current.length - 1 - end] === value[value.length - 1 - end]
	) {
		end++;
	}
	const removed = current.length - end - start;
	if (removed > 0) target.delete(start, removed);
	const inserted = value.slice(start, value.length - end);
	if (inserted) target.insert(start, inserted);
}

function withLanguages(texts: Texts, languages: readonly string[]): string[] {
	return [...Object.keys(texts), ...languages.filter((l) => !(l in texts))];
}

function newTexts(texts: Texts, languages: readonly string[]): Y.Map<Y.Text> {
	const map = new Y.Map<Y.Text>();
	for (const language of withLanguages(texts, languages)) {
		map.set(language, new Y.Text(texts[language] ?? ''));
	}
	return map;
}

function fillTexts(current: Y.Map<unknown>, texts: Texts, languages: readonly string[]) {
	for (const language of [...current.keys()]) {
		if (!(language in texts) && !languages.includes(language)) current.delete(language);
	}
	for (const language of withLanguages(texts, languages)) {
		const existing = current.get(language);
		if (existing instanceof Y.Text) setText(existing, texts[language] ?? '');
		else current.set(language, new Y.Text(texts[language] ?? ''));
	}
}

type Context = { languages: readonly string[] };

function setTexts(parent: Y.Map<unknown>, key: string, texts: unknown, ctx: Context) {
	if (texts == null) {
		if (parent.has(key)) parent.delete(key);
		return;
	}
	const current = parent.get(key);
	if (current instanceof Y.Map) fillTexts(current, texts as Texts, ctx.languages);
	else parent.set(key, newTexts(texts as Texts, ctx.languages));
}

function setTextList(parent: Y.Map<unknown>, key: string, items: unknown, ctx: Context) {
	if (items == null) {
		if (parent.has(key)) parent.delete(key);
		return;
	}
	const list = items as Texts[];
	const current = parent.get(key);
	if (!(current instanceof Y.Array)) {
		const array = new Y.Array<Y.Map<Y.Text>>();
		array.push(list.map((texts) => newTexts(texts, ctx.languages)));
		parent.set(key, array);
		return;
	}
	// Removed or added at the end, as the editor does; in place otherwise.
	if (current.length > list.length) current.delete(list.length, current.length - list.length);
	list.forEach((texts, index) => {
		const entry = index < current.length ? current.get(index) : undefined;
		if (entry instanceof Y.Map) fillTexts(entry, texts, ctx.languages);
		else {
			if (entry !== undefined) current.delete(index, 1);
			current.insert(index, [newTexts(texts, ctx.languages)]);
		}
	});
}

function setValue(parent: Y.Map<unknown>, key: string, value: unknown) {
	const encoded = stableJson(value === undefined ? null : value);
	const current = parent.get(key);
	// Compared as values, not as text: the backend writes `2.0` where this
	// writes `2`, and rewriting either would only make the two flap.
	if (typeof current === 'string' && stableJson(JSON.parse(current)) === encoded) return;
	parent.set(key, encoded);
}

/** JSON with sorted keys, as the backend writes it (`sort_keys=True`), so the
 * two sides write identical text for identical values and never flap. */
function stableJson(value: unknown): string {
	return JSON.stringify(value, (_key, v) =>
		v && typeof v === 'object' && !Array.isArray(v)
			? Object.fromEntries(
					Object.keys(v)
						.sort()
						.map((k) => [k, v[k]])
				)
			: v
	);
}

function child(parent: Y.Map<unknown>, key: string): Y.Map<unknown> {
	const current = parent.get(key);
	if (current instanceof Y.Map) return current;
	const map = new Y.Map<unknown>();
	parent.set(key, map);
	return map;
}

type Writer = (target: Y.Map<unknown>, data: Json, ctx: Context) => void;

function setFields(
	target: Y.Map<unknown>,
	data: Json,
	ctx: Context,
	spec: {
		texts?: string[];
		textLists?: string[];
		nested?: Record<string, Writer>;
		skip?: string[];
	}
) {
	const { texts = [], textLists = [], nested = {}, skip = [] } = spec;
	for (const key of [...target.keys()]) {
		if (!(key in data) && !skip.includes(key)) target.delete(key);
	}
	for (const [key, value] of Object.entries(data)) {
		if (skip.includes(key)) continue;
		if (texts.includes(key)) setTexts(target, key, value, ctx);
		else if (textLists.includes(key)) setTextList(target, key, value, ctx);
		else if (key in nested) {
			if (value == null) {
				if (target.has(key)) target.delete(key);
			} else nested[key](child(target, key), value as Json, ctx);
		} else setValue(target, key, value);
	}
}

function orderOf(entry: unknown): string | null {
	if (!(entry instanceof Y.Map)) return null;
	const raw = entry.get(ORDER);
	return typeof raw === 'string' ? (JSON.parse(raw) as string) : null;
}

/**
 * The order keys `ids` should carry, in that order, changing as few as
 * possible: the longest run of entries already in order keeps its keys, and
 * the rest get keys between their new neighbours. So moving one question
 * rewrites one key, and two people moving different questions at once do not
 * fight over the others.
 */
export function orderKeys(existing: (string | null)[]): string[] {
	// Longest strictly increasing subsequence of the existing keys.
	const tails: number[] = [];
	const previous: number[] = new Array(existing.length).fill(-1);
	existing.forEach((key, i) => {
		if (key === null) return;
		let lo = 0;
		let hi = tails.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if ((existing[tails[mid]] as string) < key) lo = mid + 1;
			else hi = mid;
		}
		if (lo > 0) previous[i] = tails[lo - 1];
		tails[lo] = i;
	});
	const kept = new Set<number>();
	for (let i = tails.length ? tails[tails.length - 1] : -1; i !== -1; i = previous[i]) kept.add(i);

	const keys: string[] = [];
	for (let i = 0; i < existing.length; i++) {
		if (kept.has(i)) {
			keys.push(existing[i] as string);
			continue;
		}
		let next: string | null = null;
		for (let j = i + 1; j < existing.length; j++) {
			if (kept.has(j)) {
				next = existing[j];
				break;
			}
		}
		keys.push(generateKeyBetween(keys.length ? keys[keys.length - 1] : null, next));
	}
	return keys;
}

function setKeyed(
	collection: Y.Map<unknown>,
	entries: [string, Json][],
	write: Writer,
	ctx: Context,
	options: { extra?: Json; keep?: boolean } = {}
) {
	const wanted = new Set(entries.map(([id]) => id));
	if (!options.keep) {
		for (const id of [...collection.keys()]) if (!wanted.has(id)) collection.delete(id);
	}
	const keys = orderKeys(entries.map(([id]) => orderOf(collection.get(id))));
	entries.forEach(([id, data], index) => {
		const existing = collection.get(id);
		let entry: Y.Map<unknown>;
		if (existing instanceof Y.Map) entry = existing;
		else {
			entry = new Y.Map<unknown>();
			collection.set(id, entry);
		}
		write(entry, data, ctx);
		setValue(entry, ORDER, keys[index]);
		for (const [key, value] of Object.entries(options.extra ?? {})) setValue(entry, key, value);
	});
}

const writeOption: Writer = (entry, data, ctx) =>
	setFields(entry, data, ctx, { texts: ['text'], skip: ['id', ORDER] });

const writeSurveyItem: Writer = (target, data, ctx) => {
	setFields(target, data, ctx, { texts: SURVEY_TEXTS, skip: ['options'] });
	const options = data.options as Json[] | undefined | null;
	if (options == null) {
		if (target.has('options')) target.delete('options');
		return;
	}
	setKeyed(
		child(target, 'options'),
		options.map((o) => [String(o.id), o]),
		writeOption,
		ctx
	);
};

const writeImage: Writer = (target, data, ctx) =>
	setFields(target, data, ctx, { texts: IMAGE_TEXTS });

const writeQuestion: Writer = (entry, data, ctx) =>
	setFields(entry, data, ctx, {
		texts: QUESTION_TEXTS,
		textLists: QUESTION_TEXT_LISTS,
		nested: { survey_item: writeSurveyItem, image: writeImage },
		skip: ['id', ORDER, SECTION_ID]
	});

const writeSection: Writer = (entry, data, ctx) =>
	setFields(entry, data, ctx, { texts: SECTION_TEXTS, skip: ['id', ORDER, 'questions'] });

function writeTimed(top: Y.Map<unknown>, items: Json[] | null | undefined, ctx: Context) {
	if (items == null) {
		if (top.has('timed_messages')) top.delete('timed_messages');
		return;
	}
	let current = top.get('timed_messages');
	if (!(current instanceof Y.Array)) {
		current = new Y.Array<Y.Map<unknown>>();
		top.set('timed_messages', current);
	}
	const array = current as Y.Array<Y.Map<unknown>>;
	if (array.length > items.length) array.delete(items.length, array.length - items.length);
	items.forEach((item, index) => {
		let entry = index < array.length ? array.get(index) : undefined;
		if (!(entry instanceof Y.Map)) {
			if (entry !== undefined) array.delete(index, 1);
			entry = new Y.Map<unknown>();
			array.insert(index, [entry]);
		}
		setFields(entry, item, ctx, { texts: TIMED_TEXTS });
	});
}

/**
 * Write `guide` into `doc` as the smallest set of changes, in one
 * transaction with `origin`. Every text gets a (possibly empty) entry in each
 * of `languages`, so nobody has to create one by typing.
 */
export function applyGuide(
	doc: Y.Doc,
	guide: LocalizedInterviewGuide,
	languages: readonly string[],
	origin?: unknown
) {
	const ctx: Context = { languages };
	const data = structuredClone(guide) as Json;
	const { guide: top, sections, questions } = roots(doc);
	doc.transact(() => {
		const timed = data.timed_messages as Json[] | null | undefined;
		const sectionList = (data.question_sections ?? []) as Json[];
		delete data.timed_messages;
		delete data.question_sections;
		setFields(top, data, ctx, { texts: GUIDE_TEXTS, skip: ['timed_messages'] });
		writeTimed(top, timed, ctx);

		setKeyed(
			sections,
			sectionList.map((s) => [String(s.id), s]),
			writeSection,
			ctx
		);
		for (const section of sectionList) {
			setKeyed(
				questions,
				((section.questions ?? []) as Json[]).map((q) => [String(q.id), q]),
				writeQuestion,
				ctx,
				{ extra: { [SECTION_ID]: section.id }, keep: true }
			);
		}
		const wanted = new Set(
			sectionList.flatMap((s) => ((s.questions ?? []) as Json[]).map((q) => String(q.id)))
		);
		for (const id of [...questions.keys()]) if (!wanted.has(id)) questions.delete(id);
	}, origin);
}

// ---- Reading ---------------------------------------------------------------

function readTexts(value: unknown): Texts {
	// An emptied language is untranslated, as if never written; see the
	// backend's `_read_texts`.
	const texts: Texts = {};
	if (value instanceof Y.Map) {
		for (const [language, text] of value.entries()) {
			if (text instanceof Y.Text && text.length) texts[language] = text.toString();
		}
	}
	return texts;
}

function readEntity(source: Y.Map<unknown>, texts: string[]): Json {
	const data: Json = {};
	for (const [key, value] of source.entries()) {
		if (texts.includes(key)) data[key] = readTexts(value);
		else if (value instanceof Y.Array) {
			data[key] = value.toArray().map((entry) => readTexts(entry));
		} else if (value instanceof Y.Map) data[key] = value;
		else if (typeof value === 'string') data[key] = JSON.parse(value);
	}
	return data;
}

function sorted(collection: Y.Map<unknown>): [string, Y.Map<unknown>][] {
	return [...collection.entries()]
		.filter((entry): entry is [string, Y.Map<unknown>] => entry[1] instanceof Y.Map)
		.map(([id, entry]) => [id, entry, orderOf(entry) ?? ''] as const)
		.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[0] < b[0] ? -1 : 1))
		.map(([id, entry]) => [id, entry]);
}

function readQuestion(id: string, entry: Y.Map<unknown>): Json {
	const data = readEntity(entry, QUESTION_TEXTS);
	delete data[ORDER];
	delete data[SECTION_ID];
	if (data.survey_item instanceof Y.Map) {
		const survey = readEntity(data.survey_item, SURVEY_TEXTS);
		if (survey.options instanceof Y.Map) {
			survey.options = sorted(survey.options).map(([optionId, option]) => ({
				id: optionId,
				text: readTexts(option.get('text'))
			}));
		}
		data.survey_item = survey;
	}
	if (data.image instanceof Y.Map) data.image = readEntity(data.image, IMAGE_TEXTS);
	return { id, ...data };
}

/** The doc as a guide. A question whose section is gone is left out, as the
 * backend does. */
export function readGuide(doc: Y.Doc): LocalizedInterviewGuide {
	const { guide: top, sections, questions } = roots(doc);
	const data = readEntity(top, GUIDE_TEXTS);
	const timed = top.get('timed_messages');
	if (timed instanceof Y.Array) {
		data.timed_messages = timed
			.toArray()
			.filter((entry): entry is Y.Map<unknown> => entry instanceof Y.Map)
			.map((entry) => readEntity(entry, TIMED_TEXTS));
	}
	const bySection = new Map<string, [string, Y.Map<unknown>][]>();
	for (const [id, entry] of sorted(questions)) {
		const raw = entry.get(SECTION_ID);
		if (typeof raw !== 'string') continue;
		const sectionId = JSON.parse(raw) as string;
		if (!bySection.has(sectionId)) bySection.set(sectionId, []);
		bySection.get(sectionId)!.push([id, entry]);
	}
	data.question_sections = sorted(sections).map(([id, entry]) => {
		const section = readEntity(entry, SECTION_TEXTS);
		delete section[ORDER];
		return {
			id,
			...section,
			questions: (bySection.get(id) ?? []).map(([qId, q]) => readQuestion(qId, q))
		};
	});
	return data as LocalizedInterviewGuide;
}
