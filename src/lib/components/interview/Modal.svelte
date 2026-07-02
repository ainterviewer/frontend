<script lang="ts">
	let { show = false, title, onClose, children } = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && show) {
			onClose?.();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<div
		class="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-all"
		role="dialog"
		aria-modal="true"
	>
		<button
			class="absolute inset-0 h-full w-full cursor-default focus:outline-none"
			onclick={onClose}
			aria-label="Close modal"
			type="button"
		></button>
		<div
			class="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white py-6 shadow-2xl ring-1 ring-black/5"
		>
			<div class="flex items-center justify-between border-b border-gray-100 px-10 pb-5">
				<h2 class="text-lg font-semibold text-gray-900">{title}</h2>
				<button
					class="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
					onclick={onClose}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark text-lg"></i>
				</button>
			</div>
			<div class="px-10 pt-5">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
