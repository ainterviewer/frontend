import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { bindFlat } from './bindFlat.svelte';
import type { ContentSession } from './contentSession.svelte';
import { applyFlat, flatRoots, readFlat } from './flatDoc';

// The consent and welcome pages' binding, with real reactive state: what the
// page holds is $state proxies, which plain-object tests never see.

const TEXTS = ['title', 'text'];
const DEFAULTS = { title: {}, text: {}, email: '' };

function session(loaded: boolean): ContentSession {
	const doc = new Y.Doc();
	applyFlat(doc, { title: { EN: 'Hello' }, email: 'a@b.dk' }, TEXTS, ['EN', 'DA']);
	// Reactive, as the real session's `loaded` is.
	const reactive = $state({ doc, loaded });
	return reactive as unknown as ContentSession;
}

function bound(s: ContentSession) {
	const state = $state<Record<string, unknown>>(structuredClone(DEFAULTS));
	const stop = $effect.root(() => {
		bindFlat({
			session: s,
			state,
			texts: TEXTS,
			defaults: DEFAULTS,
			languages: () => ['EN', 'DA']
		});
	});
	flushSync();
	return { state: state as { title: Record<string, string>; email: string }, stop };
}

describe('flat doc', () => {
	it('gives every text an empty entry per language, read back as untranslated', () => {
		const doc = new Y.Doc();
		applyFlat(doc, {}, TEXTS, ['EN', 'DA']);
		const title = flatRoots(doc).content.get('title') as Y.Map<Y.Text>;
		expect([...title.keys()].sort()).toEqual(['DA', 'EN']);
		expect(readFlat(doc, TEXTS)).toEqual({ title: {}, text: {} });
	});
});

describe('bindFlat', () => {
	it('loads the doc, then writes edits into it', () => {
		const s = session(true);
		const { state, stop } = bound(s);
		expect(state.title).toEqual({ EN: 'Hello' });

		state.title.EN = 'Hello there';
		state.email = 'c@d.dk';
		flushSync();

		expect(readFlat(s.doc, TEXTS)).toMatchObject({ title: { EN: 'Hello there' }, email: 'c@d.dk' });
		stop();
	});

	it('writes edits made after a doc that loaded once the page was up', () => {
		const s = session(false);
		const { state, stop } = bound(s);
		(s as { loaded: boolean }).loaded = true;
		flushSync();

		state.title.DA = 'Hej';
		flushSync();
		expect(readFlat(s.doc, TEXTS).title).toEqual({ EN: 'Hello', DA: 'Hej' });
		stop();
	});

	it('reads changes from elsewhere into the state', () => {
		const s = session(true);
		const { state, stop } = bound(s);

		const other = new Y.Doc();
		Y.applyUpdate(other, Y.encodeStateAsUpdate(s.doc));
		const title = (flatRoots(other).content.get('title') as Y.Map<Y.Text>).get('EN')!;
		title.insert(title.length, '!');
		Y.applyUpdate(s.doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(s.doc)));
		flushSync();

		expect(state.title).toEqual({ EN: 'Hello!' });
		stop();
	});
});
