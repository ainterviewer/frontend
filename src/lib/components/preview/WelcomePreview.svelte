<script lang="ts">
	// The welcome screen as participants see it, drawn inline: the welcome
	// page's live preview and the version history's preview of a saved one.
	let {
		title,
		text,
		videoUrl = null,
		email = null,
		scroll = true
	}: {
		title: string;
		text: string;
		videoUrl?: string | null;
		email?: string | null;
		/** Scroll inside a capped height; off where the container scrolls. */
		scroll?: boolean;
	} = $props();
</script>

<div class="preview overflow-hidden rounded-lg border border-gray-300 bg-white shadow-xl">
	<div class={['p-6', scroll && 'max-h-[600px] overflow-y-auto']}>
		<h2 class="mb-4 text-xl font-bold text-gray-900">
			{title || 'Welcome Title'}
		</h2>

		{#if videoUrl}
			<div class="mb-4 overflow-hidden rounded-lg bg-black">
				<video controls class="w-full">
					<source src={videoUrl} type="video/mp4" />
					Your browser does not support the video tag.
				</video>
			</div>
		{/if}

		<div class="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
			{#if text}
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html text}
			{:else}
				<span class="text-gray-400 italic"> Your welcome message will appear here... </span>
			{/if}
		</div>

		<hr class="my-4 border-gray-200" />

		<div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
			<p class="mb-2">
				If you wish to withdraw your consent or change your answers, please contact
				{#if email}
					<a href="mailto:{email}" class="font-medium text-primary hover:underline">
						{email}
					</a>
				{:else}
					<span class="text-gray-400">[contact email]</span>
				{/if}
				with a reference to the following code:
			</p>

			<div
				class="my-2 flex w-fit items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
			>
				<code class="font-mono text-sm text-gray-700">&lt;interview-id&gt;</code>
				<i class="fa-solid fa-fingerprint text-gray-400"></i>
			</div>

			<p class="text-xs text-gray-500">
				It is your own responsibility to store this code securely before starting the interview.
			</p>
		</div>

		<div class="mt-6">
			<button
				class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
				disabled
			>
				Start Interview
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
