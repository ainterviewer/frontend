import { tick } from 'svelte';

import type { ExternalParam } from '$lib/api/types.gen';
import { type ContentSession, LOCAL_ORIGIN } from '$lib/collab/contentSession.svelte';
import { applyGuide, readGuide } from '$lib/collab/guideDoc';
import { CaretKeeper, reconcile, reconcileList, reconcileRecord } from '$lib/collab/reconcile';
import type { GuideStore } from '$lib/stores/guideStore.svelte';

import { localGuide, mapToLocal } from './normalize';

// Ties the guide editor's store to the shared doc, both ways, so the editor
// itself stays as it was: components edit the store; this writes the store
// into the doc and the doc into the store.
//
// - Store -> doc: an effect writes the whole guide into the doc as a minimal
//   diff (`applyGuide`) whenever the store changes. It runs in the microtask
//   after the edit, before the next websocket message can be handled, so it
//   always diffs against a doc that already holds every remote change: what
//   it writes is exactly the local edit, and Yjs merges it character by
//   character.
// - Doc -> store: a remote change is read out of the doc and reconciled into
//   the store in place, keeping every object that did not change, so only
//   what changed re-renders and the caret in the field being typed in keeps
//   its place.

type Options = {
	session: ContentSession;
	store: GuideStore;
	/** The project's languages: every text gets an entry in each. */
	languages: () => string[];
	externalParams: () => ExternalParam[];
	/** Called once the doc has loaded into the store. */
	onLoad?: () => void;
};

export function bindGuide({ session, store, languages, externalParams, onLoad }: Options) {
	let loaded = false;
	let applyingRemote = false;

	function readIntoStore() {
		const mapped = mapToLocal(readGuide(session.doc));
		applyingRemote = true;
		try {
			reconcile(store.top, mapped.top);
			reconcileList(store.localSections, mapped.sections);
			reconcileRecord(store.localQuestions, mapped.questions);
		} finally {
			applyingRemote = false;
		}
	}

	function onUpdate(_update: Uint8Array, origin: unknown) {
		if (origin === LOCAL_ORIGIN || !loaded) return;
		const caret = CaretKeeper.capture();
		readIntoStore();
		void tick().then(() => caret?.restore());
	}
	session.doc.on('update', onUpdate);

	// The first sync: the doc replaces whatever the page was rendered with.
	$effect(() => {
		if (!session.loaded || loaded) return;
		readIntoStore();
		loaded = true;
		onLoad?.();
	});

	$effect(() => {
		// Read the whole guide -- every run, before anything can return early
		// -- so this runs on any change to it: an effect tracks only what its
		// last run read, and a run before the doc loaded that stopped short
		// would never wake for a keystroke. The snapshot is what reads it all
		// (and is a plain copy, which `applyGuide`'s `structuredClone` needs:
		// the store holds reactive proxies).
		const guide = $state.snapshot(
			localGuide(store.top, store.localSections, store.localQuestions, externalParams())
		);
		const langs = languages();
		if (!loaded || applyingRemote) return;
		applyGuide(session.doc, guide, langs, LOCAL_ORIGIN);
	});

	return () => session.doc.off('update', onUpdate);
}
