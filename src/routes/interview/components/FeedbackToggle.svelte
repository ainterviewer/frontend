<script lang="ts">
	let { feedback = null, onFeedback } = $props();

	let _showMenu = $state(false);

	function toggleMenu() {
		_showMenu = !_showMenu;
	}

	function handleFeedback(type: 'positive' | 'negative') {
		const newFeedback = feedback === type ? null : type;
		onFeedback(newFeedback);
		_showMenu = false;
	}

	function handleMouseLeave() {
		_showMenu = false;
	}
</script>

<div class="relative" onmouseleave={handleMouseLeave} role="menu" tabindex="0">
	<!-- Toggle Button -->
	<button
		type="button"
		class="flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-all hover:bg-white hover:text-gray-500 hover:shadow-sm"
		onclick={toggleMenu}
		aria-label="Toggle feedback menu"
	>
		<i class="fa-solid fa-ellipsis-vertical"></i>
	</button>

	<!-- Menu -->
	{#if _showMenu}
		<div class="absolute bottom-full left-1/2 z-10 -translate-x-1/2 pb-2">
			<div
				class="flex flex-row gap-1 rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl ring-1 ring-black/5"
				role="group"
			>
				<!-- Positive -->
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-green-50 hover:text-green-600
                {feedback === 'positive' ? 'bg-green-50 text-green-600' : ''}"
					onclick={() => handleFeedback('positive')}
					aria-label="Positive feedback"
				>
					<i class="fa-solid fa-thumbs-up"></i>
				</button>

				<!-- Negative -->
				<button
					type="button"
					class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-red-50 hover:text-red-600
                {feedback === 'negative' ? 'bg-red-50 text-red-600' : ''}"
					onclick={() => handleFeedback('negative')}
					aria-label="Negative feedback"
				>
					<i class="fa-solid fa-thumbs-down"></i>
				</button>
			</div>
		</div>
	{/if}
</div>
