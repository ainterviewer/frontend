<script lang="ts">
	interface Props {
		totalItems: number;
		itemsPerPage: number;
		currentPage: number;
		onPageChange: (page: number) => void;
		onItemsPerPageChange: (itemsPerPage: number) => void;
		itemName?: string;
	}

	let {
		totalItems,
		itemsPerPage,
		currentPage,
		onPageChange,
		onItemsPerPageChange,
		itemName = 'items'
	}: Props = $props();

	let totalPages = $derived(Math.ceil(totalItems / itemsPerPage));

	function handleLimitChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		onItemsPerPageChange(parseInt(select.value));
	}
</script>

<div class="mt-6 flex flex-col items-center justify-between text-sm text-gray-700 sm:flex-row">
	<div class="mb-4 sm:mb-0">
		{#if totalItems > 0}
			Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to {Math.min(
				currentPage * itemsPerPage,
				totalItems
			)} of {totalItems}
			{itemName}
		{:else}
			No {itemName}
		{/if}
	</div>

	<!-- Pagination Controls -->
	<div class="flex items-center">
		<button
			class="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
			onclick={() => onPageChange(currentPage - 1)}
			disabled={currentPage === 1}
			aria-label="Previous page"
		>
			<i class="fa-solid fa-chevron-left"></i>
		</button>

		<div class="mx-2 flex space-x-1">
			{#if totalPages <= 7}
				{#each Array(totalPages) as _, i}
					<button
						class="rounded border px-3 py-1 {currentPage === i + 1
							? 'border-blue-500 bg-blue-500 text-white'
							: 'border-gray-300 bg-white hover:bg-gray-100'}"
						onclick={() => onPageChange(i + 1)}
					>
						{i + 1}
					</button>
				{/each}
			{:else}
				<button
					class="rounded border px-3 py-1 {currentPage === 1
						? 'border-blue-500 bg-blue-500 text-white'
						: 'border-gray-300 bg-white hover:bg-gray-100'}"
					onclick={() => onPageChange(1)}>1</button
				>
				{#if currentPage > 3}
					<span class="px-2">...</span>
				{/if}

				{#if currentPage > 1 && currentPage < totalPages}
					{#if currentPage > 2}
						<button
							class="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100"
							onclick={() => onPageChange(currentPage - 1)}>{currentPage - 1}</button
						>
					{/if}
					<button class="rounded border border-blue-500 bg-blue-500 px-3 py-1 text-white" disabled
						>{currentPage}</button
					>
					{#if currentPage < totalPages - 1}
						<button
							class="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100"
							onclick={() => onPageChange(currentPage + 1)}>{currentPage + 1}</button
						>
					{/if}
				{/if}

				{#if currentPage < totalPages - 2}
					<span class="px-2">...</span>
				{/if}
				<button
					class="rounded border px-3 py-1 {currentPage === totalPages
						? 'border-blue-500 bg-blue-500 text-white'
						: 'border-gray-300 bg-white hover:bg-gray-100'}"
					onclick={() => onPageChange(totalPages)}>{totalPages}</button
				>
			{/if}
		</div>

		<button
			class="rounded border border-gray-300 bg-white px-3 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
			onclick={() => onPageChange(currentPage + 1)}
			disabled={currentPage === totalPages || totalPages === 0}
			aria-label="Next page"
		>
			<i class="fa-solid fa-chevron-right"></i>
		</button>
	</div>

	<!-- Items per page selector -->
	<div class="flex items-center gap-2">
		<label for="items-per-page" class="w-fit text-gray-600">Items per page:</label>
		<select
			id="items-per-page"
			class="block w-fit form-select rounded-md border-gray-300 py-1 pr-10 pl-3 text-base focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
			value={itemsPerPage}
			onchange={handleLimitChange}
		>
			<option value={10}>10</option>
			<option value={20}>20</option>
			<option value={50}>50</option>
			<option value={100}>100</option>
		</select>
	</div>
</div>
