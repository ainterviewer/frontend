import { tick } from 'svelte';

import type { ExternalParam } from '$lib/api/types.gen';
import { applyGuide, readGuide } from '$lib/collab/guideDoc';
import { type GuideSession, LOCAL_ORIGIN } from '$lib/collab/guideSession.svelte';
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
	session: GuideSession;
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

// ---- reconciling, in place ---------------------------------------------------

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasIds(list: unknown[]): list is { id: string }[] {
	return list.length > 0 && list.every((e) => isObject(e) && typeof e.id === 'string');
}

/** Make `target` equal `source`, writing only what differs. */
export function reconcile(target: Obj, source: Obj) {
	for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
	for (const [key, value] of Object.entries(source)) {
		const current = target[key];
		if (isObject(current) && isObject(value)) reconcile(current, value);
		else if (Array.isArray(current) && Array.isArray(value)) reconcileList(current, value);
		else if (current !== value) target[key] = value;
	}
}

export function reconcileList(target: unknown[], source: unknown[]) {
	if (hasIds(source) && (target.length === 0 || hasIds(target))) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a local of this one call, never state
		const byId = new Map((target as { id: string }[]).map((e) => [e.id, e]));
		const next = source.map((entry) => {
			const existing = byId.get(entry.id);
			if (!existing) return entry;
			reconcile(existing as Obj, entry as Obj);
			return existing;
		});
		if (next.length !== target.length || next.some((e, i) => e !== target[i])) {
			target.splice(0, target.length, ...next);
		}
		return;
	}
	if (target.length > source.length) target.splice(source.length);
	source.forEach((value, index) => {
		const current = target[index];
		if (isObject(current) && isObject(value)) reconcile(current, value);
		else if (Array.isArray(current) && Array.isArray(value)) reconcileList(current, value);
		else if (current !== value || index >= target.length) target[index] = value;
	});
}

function reconcileRecord(target: Record<string, unknown[]>, source: Record<string, unknown[]>) {
	for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
	for (const [key, list] of Object.entries(source)) {
		if (Array.isArray(target[key])) reconcileList(target[key], list);
		else target[key] = list;
	}
}

// ---- keeping the caret -------------------------------------------------------

/** The caret in the focused field, moved past text inserted before it. */
class CaretKeeper {
	constructor(
		private el: HTMLInputElement | HTMLTextAreaElement,
		private before: string,
		private start: number,
		private end: number
	) {}

	static capture(): CaretKeeper | null {
		const el = document.activeElement;
		if (!(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) return null;
		if (el.selectionStart === null || el.selectionEnd === null) return null;
		return new CaretKeeper(el, el.value, el.selectionStart, el.selectionEnd);
	}

	restore() {
		const after = this.el.value;
		if (after === this.before || document.activeElement !== this.el) return;
		// Where the change starts and how much longer it made the text.
		let prefix = 0;
		const limit = Math.min(after.length, this.before.length);
		while (prefix < limit && after[prefix] === this.before[prefix]) prefix++;
		const delta = after.length - this.before.length;
		const move = (position: number) =>
			position <= prefix ? position : Math.max(prefix, position + delta);
		this.el.setSelectionRange(move(this.start), move(this.end));
	}
}
