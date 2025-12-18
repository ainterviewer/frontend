<script lang="ts">
	interface Props {
		label: string;
		column: string;
		sortColumn: string;
		sortOrder: 'asc' | 'desc';
		onSort: (column: string) => void;
	}

	let { label, column, sortColumn, sortOrder, onSort }: Props = $props();
</script>

<th
	class="group cursor-pointer px-5 py-3 hover:bg-secondary hover:brightness-110"
	onclick={() => onSort(column)}
>
	<div class="flex items-center">
		{label}
		{#if sortColumn === column}
			<i class="fa-solid fa-sort-{sortOrder === 'asc' ? 'up' : 'down'} ml-2"></i>
		{:else}
			<i class="fa-solid fa-sort ml-2 text-gray-400 group-hover:text-gray-500"></i>
		{/if}
	</div>
</th>
