import { getContext, setContext } from 'svelte';

import type { DropPosition } from '$lib/coding/codeDrop';
import type { CodeId } from '$lib/coding/codingTree';

/**
 * What a drag over the code table is currently proposing.
 *
 * Held in one object shared by every row rather than passed down the
 * recursion, because a row has to know about a drag that is nowhere near it:
 * the row being dragged renders faded, the row under the pointer draws the
 * line, and every other row has to draw neither. Prop-drilling that through an
 * arbitrarily deep tree would re-render the whole table on every pointer move
 * for the sake of two rows that changed.
 */
export class CodeDrag {
	/** The code being dragged, or `null` when nothing is. */
	id = $state<CodeId | null>(null);
	/** The row under the pointer. */
	overId = $state<CodeId | null>(null);
	position = $state<DropPosition>('inside');
	/** Whether letting go here would be allowed -- see `resolveDrop`. */
	valid = $state(false);

	get active(): boolean {
		return this.id !== null;
	}

	start(id: CodeId) {
		this.id = id;
		this.overId = null;
		this.valid = false;
	}

	over(overId: CodeId | null, position: DropPosition, valid: boolean) {
		this.overId = overId;
		this.position = position;
		this.valid = valid;
	}

	end() {
		this.id = null;
		this.overId = null;
		this.valid = false;
	}
}

const KEY = Symbol('code-table-drag');

export function provideCodeDrag(drag: CodeDrag) {
	setContext(KEY, drag);
}

export function useCodeDrag(): CodeDrag {
	return getContext<CodeDrag>(KEY);
}
