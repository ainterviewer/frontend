<script lang="ts">
	// The consent dialog as participants see it, drawn inline: the consent
	// page's live preview and the version history's preview of a saved one.
	let {
		title,
		text,
		scroll = true
	}: {
		title: string;
		text: string;
		/** Scroll inside a capped height; off where the container scrolls. */
		scroll?: boolean;
	} = $props();
</script>

<div class="preview overflow-hidden rounded-lg border border-gray-300 bg-white shadow-xl">
	<div class={['p-6', scroll && 'max-h-[500px] overflow-y-auto']}>
		<h2 class="mb-4 text-xl font-bold text-gray-900">
			{title || 'Consent Title'}
		</h2>
		<div class="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
			{#if text}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html text}
			{:else}
				<span class="text-gray-400 italic"> Your consent message will appear here... </span>
			{/if}
		</div>
		<div class="mt-6 flex gap-3">
			<button
				class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
				disabled
			>
				Accept
			</button>
			<button
				class="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300"
				disabled
			>
				Decline
			</button>
		</div>
	</div>
</div>

<style>
	.preview :global(a) {
		color: #2563eb;
		text-decoration: underline;
		font-weight: 500;
		transition:
			color 0.2s ease,
			text-decoration-color 0.2s ease;
	}
	.preview :global(a):hover {
		color: #1547b0;
		cursor: pointer;
	}
	.preview :global(a):active {
		color: #0f2d6e;
	}
</style>
