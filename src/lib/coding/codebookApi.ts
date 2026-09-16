import type { CodeBase, CodePublic } from '$lib/api/types.gen';
import { DEFAULT_CODE_COLOR, DEFAULT_SCORE_MAX, DEFAULT_SCORE_MIN, type Code } from './codingTree';

/**
 * The codebook as the API states it, and as the editor states it.
 *
 * Two differences, both deliberate on the API's side. A position is two
 * nullable columns there and one nullable point here, because a point is what
 * the canvas reads and "half a position" is not a state either side should be
 * able to express. And every field but the id is optional in the payload,
 * because the backend has a default for each -- the editor does not, so the
 * gaps are filled in on the way in rather than left to every reader of a
 * `Code` to handle.
 *
 * Kept apart from `codingTree.ts` so that the codebook's rules stay free of
 * the generated SDK, and from the store so the mapping can be tested without
 * a network.
 */

export function codeFromApi(code: CodePublic): Code {
	const kind = code.kind ?? 'tag';
	const scored = kind === 'score';
	return {
		id: code.id,
		parentId: code.parent_id ?? null,
		name: code.name ?? '',
		definition: code.definition ?? '',
		memo: code.memo ?? '',
		color: code.color || DEFAULT_CODE_COLOR,
		// Both or neither: a code with one coordinate has no position, and
		// letting it through would put a node at x=0 on the reader's canvas.
		position:
			code.position_x === null ||
			code.position_x === undefined ||
			code.position_y === null ||
			code.position_y === undefined
				? null
				: { x: code.position_x, y: code.position_y },
		kind,
		minValue: scored ? (code.min_value ?? DEFAULT_SCORE_MIN) : null,
		maxValue: scored ? (code.max_value ?? DEFAULT_SCORE_MAX) : null
	};
}

export function codeToApi(code: Code): CodeBase {
	return {
		id: code.id,
		parent_id: code.parentId,
		name: code.name,
		definition: code.definition,
		memo: code.memo,
		color: code.color,
		kind: code.kind,
		min_value: code.minValue,
		max_value: code.maxValue,
		position_x: code.position?.x ?? null,
		position_y: code.position?.y ?? null
	};
}

export function codesFromApi(codes: CodePublic[]): Code[] {
	return codes.map(codeFromApi);
}

export function codesToApi(codes: readonly Code[]): CodeBase[] {
	return codes.map(codeToApi);
}
