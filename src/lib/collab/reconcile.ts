// Making reactive state equal what a doc now reads, in place: only what
// differs is written, so only that re-renders, and the caret in the field
// being typed in keeps its place. Shared by the editors bound to a doc
// (`bindGuide`, `bindFlat`).

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

export function reconcileRecord(
	target: Record<string, unknown[]>,
	source: Record<string, unknown[]>
) {
	for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
	for (const [key, list] of Object.entries(source)) {
		if (Array.isArray(target[key])) reconcileList(target[key], list);
		else target[key] = list;
	}
}

// ---- keeping the caret -------------------------------------------------------

/** The caret in the focused field, moved past text inserted before it. */
export class CaretKeeper {
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
