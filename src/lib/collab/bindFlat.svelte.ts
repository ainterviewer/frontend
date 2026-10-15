import { tick } from 'svelte';

import type { ContentSession } from './contentSession.svelte';
import { LOCAL_ORIGIN } from './contentSession.svelte';
import { applyFlat, readFlat } from './flatDoc';
import type { Json } from './guideDoc';
import { CaretKeeper, reconcile } from './reconcile';

// Ties a page's state -- the consent, the welcome screen -- to its part's doc,
// both ways, as `bindGuide` does for the guide: the page binds its fields to
// `state`; this writes `state` into the doc after each edit, and remote
// changes into `state` in place, the caret kept.

type Options = {
	session: ContentSession;
	/** The page's `$state` object: its text fields and values. */
	state: Json;
	/** Which of its fields are text, a language -> text map each. */
	texts: string[];
	/** What a field the doc lacks reads as: the page's initial values. */
	defaults: Json;
	/** The project's languages: every text gets an entry in each. */
	languages: () => string[];
};

export function bindFlat({ session, state, texts, defaults, languages }: Options) {
	let loaded = false;
	let applyingRemote = false;

	function readIntoState() {
		applyingRemote = true;
		try {
			reconcile(state, { ...structuredClone(defaults), ...readFlat(session.doc, texts) });
		} finally {
			applyingRemote = false;
		}
	}

	function onUpdate(_update: Uint8Array, origin: unknown) {
		if (origin === LOCAL_ORIGIN || !loaded) return;
		const caret = CaretKeeper.capture();
		readIntoState();
		void tick().then(() => caret?.restore());
	}
	session.doc.on('update', onUpdate);

	// The first sync: the doc replaces whatever the page was rendered with.
	$effect(() => {
		if (!session.loaded || loaded) return;
		readIntoState();
		loaded = true;
	});

	$effect(() => {
		// Read all of it on every run, before returning early: an effect
		// tracks only what its last run read (see `bindGuide`).
		const data = $state.snapshot(state) as Json;
		const langs = languages();
		if (!loaded || applyingRemote) return;
		applyFlat(session.doc, data, texts, langs, LOCAL_ORIGIN);
	});

	return () => session.doc.off('update', onUpdate);
}
