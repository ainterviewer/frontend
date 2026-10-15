import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { applyGuide, readGuide, roots } from '$lib/collab/guideDoc';
import type { GuideSession } from '$lib/collab/guideSession.svelte';
import { createGuideStore } from '$lib/stores/guideStore.svelte';

import { bindGuide } from './bindGuide.svelte';
import { mapToLocal } from './normalize';

// The binding with a real, reactive store: what the editor holds is $state
// proxies, which plain-object tests of the doc mapping never see.

const SECTION = '11111111-1111-4111-8111-111111111111';
const QUESTION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function loadedSession(): GuideSession {
	return seededSession(true);
}

function seededSession(loaded: boolean): GuideSession {
	const doc = new Y.Doc();
	applyGuide(
		doc,
		{
			framing: { EN: 'Framing' },
			question_sections: [
				{
					id: SECTION,
					description: { EN: 'One' },
					questions: [{ id: QUESTION, main_question: { EN: 'Why?' } }]
				}
			]
		},
		['EN']
	);
	// Reactive, as the real session's `loaded` is.
	const session = $state({ doc, loaded });
	return session as unknown as GuideSession;
}

/** The editor bound to `session`. `rendered`: the store starts out holding
 * what the page was loaded with -- the doc's guide -- as the real page's does. */
function bound(session: GuideSession, rendered = false) {
	const store = createGuideStore(
		() => 'EN',
		() => 'EN'
	);
	if (rendered) {
		const mapped = mapToLocal(readGuide(session.doc));
		store.localSections = mapped.sections;
		store.localQuestions = mapped.questions;
		store.top = mapped.top;
	}
	const stop = $effect.root(() => {
		bindGuide({ session, store, languages: () => ['EN'], externalParams: () => [] });
	});
	flushSync();
	return { store, stop };
}

describe('bindGuide', () => {
	it('writes edits to the store into the doc', () => {
		const session = loadedSession();
		const { store, stop } = bound(session);
		expect(store.top.framing).toEqual({ EN: 'Framing' });

		store.top.framing.EN = 'Framing, edited';
		store.localQuestions[SECTION][0].main_question.EN = 'Why not?';
		flushSync();

		const guide = readGuide(session.doc);
		expect(guide.framing).toEqual({ EN: 'Framing, edited' });
		expect(guide.question_sections![0].questions![0].main_question).toEqual({ EN: 'Why not?' });
		stop();
	});

	it('writes edits made after a doc that loaded once the editor was up', () => {
		// The page renders the guide it loaded and mounts before the socket
		// has synced; the doc then loads with nothing to change in the store.
		const session = seededSession(false);
		const { store, stop } = bound(session, true);
		(session as { loaded: boolean }).loaded = true;
		flushSync();
		expect(store.top.framing).toEqual({ EN: 'Framing' });

		store.top.framing.EN = 'Framing, typed';
		flushSync();
		expect(readGuide(session.doc).framing).toEqual({ EN: 'Framing, typed' });
		stop();
	});

	it('keeps writing after the editor is mounted again on the same doc', () => {
		const session = loadedSession();
		bound(session).stop();
		const { store, stop } = bound(session);

		store.top.framing.EN = 'Again';
		flushSync();
		expect(readGuide(session.doc).framing).toEqual({ EN: 'Again' });
		stop();
	});

	it('reads changes from elsewhere into the store', () => {
		const session = loadedSession();
		const { store, stop } = bound(session);

		const other = new Y.Doc();
		Y.applyUpdate(other, Y.encodeStateAsUpdate(session.doc));
		const framing = (roots(other).guide.get('framing') as Y.Map<Y.Text>).get('EN')!;
		framing.insert(framing.length, '!');
		Y.applyUpdate(session.doc, Y.encodeStateAsUpdate(other, Y.encodeStateVector(session.doc)));
		flushSync();

		expect(store.top.framing).toEqual({ EN: 'Framing!' });
		stop();
	});
});
