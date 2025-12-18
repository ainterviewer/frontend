<script lang="ts">
	let { show = false, title, onClose, children } = $props();
</script>

{#if show}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-all"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
		>
			<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
				<h2 class="text-lg font-semibold text-gray-900">{title}</h2>
				<button
					class="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
					onclick={onClose}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark text-lg"></i>
				</button>
			</div>
			<div class="px-6 py-6">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
