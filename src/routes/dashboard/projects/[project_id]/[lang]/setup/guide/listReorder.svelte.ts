import { tick } from 'svelte';

// Small helper for reordering a single list rendered as rows, by dragging the
// grip handle or by focusing it and pressing the arrow keys. The row (matched
// by `rowSelector`) is the drag image. `getList` returns the live array to
// mutate in place. The handle carries `data-reorder-handle`, so focus can
// follow the item it moved.
export function createListReorder<T>(getList: () => T[] | null | undefined, rowSelector: string) {
	let draggedIndex = $state<number | null>(null);

	function dragStart(e: DragEvent, idx: number) {
		draggedIndex = idx;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			const row = (e.currentTarget as HTMLElement).closest(rowSelector);
			if (row) e.dataTransfer.setDragImage(row as HTMLElement, 0, 0);
		}
	}

	function dragOver(e: DragEvent, idx: number) {
		e.preventDefault();
		const list = getList();
		if (draggedIndex === null || draggedIndex === idx || !list) return;
		const [moved] = list.splice(draggedIndex, 1);
		list.splice(idx, 0, moved);
		draggedIndex = idx;
	}

	function dragEnd() {
		draggedIndex = null;
	}

	async function keydown(e: KeyboardEvent, idx: number) {
		const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
		const list = getList();
		if (!step || !list) return;
		e.preventDefault();
		const to = idx + step;
		if (to < 0 || to >= list.length) return;
		const container = (e.currentTarget as HTMLElement).closest(rowSelector)?.parentElement;
		const [moved] = list.splice(idx, 1);
		list.splice(to, 0, moved);
		// Focus the handle of the row the item moved to: with rows keyed by
		// index, the focused handle stays put while its content changes.
		await tick();
		container
			?.querySelectorAll(rowSelector)
			[to]?.querySelector<HTMLElement>('[data-reorder-handle]')
			?.focus();
	}

	return {
		get draggedIndex() {
			return draggedIndex;
		},
		dragStart,
		dragOver,
		dragEnd,
		keydown
	};
}
