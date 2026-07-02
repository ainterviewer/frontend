// Small helper for drag-to-reorder within a single list rendered as rows. The
// grip handle is what's draggable, so we use the row (matched by `rowSelector`)
// as the drag image. `getList` returns the live array to mutate in place.
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

	return {
		get draggedIndex() {
			return draggedIndex;
		},
		dragStart,
		dragOver,
		dragEnd
	};
}
