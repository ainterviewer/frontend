import * as Y from 'yjs';

import { type Json, readEntity, setFields } from './guideDoc';

// A flat part of the content -- the consent, the welcome screen -- as a Yjs
// document, mirroring the backend's `app/collab/flat_doc.py` key for key:
// one root map, `content`, whose text fields are a `Y.Map` of language to
// `Y.Text` (an empty one for each of the project's languages) and whose
// other fields are JSON text.
//
// Root keys: `meta` (`doc_id`) and `content`.

export function flatRoots(doc: Y.Doc) {
	return { meta: doc.getMap<unknown>('meta'), content: doc.getMap<unknown>('content') };
}

/**
 * Write `data` into `doc` as the smallest set of changes, in one transaction
 * with `origin`. Every one of `texts` is written, empty if `data` lacks it,
 * so it has an entry in each of `languages` nobody has to create by typing.
 */
export function applyFlat(
	doc: Y.Doc,
	data: Json,
	texts: string[],
	languages: readonly string[],
	origin: unknown = null
) {
	const filled: Json = { ...data };
	for (const key of texts) filled[key] = filled[key] ?? {};
	doc.transact(() => {
		setFields(flatRoots(doc).content, filled, { languages }, { texts });
	}, origin);
}

/** The doc's content as plain data. */
export function readFlat(doc: Y.Doc, texts: string[]): Json {
	return readEntity(flatRoots(doc).content, texts);
}
