<script lang="ts">
	import type { TemplatePlaceholder } from '$lib/api/types.gen';
	import { placeholderPattern } from '$lib/tiptap/placeholders';

	// A participant email with its placeholders filled in for a sample
	// participant: the email page's preview and the version history's preview
	// of a saved one.
	let {
		projectId,
		subject,
		html
	}: {
		projectId: string;
		subject: string;
		html: string;
	} = $props();

	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');

	const sample: Record<TemplatePlaceholder, string> = $derived({
		name: 'Jane Doe',
		email: 'jane@example.com',
		pid: 'P-001',
		interview_url: origin ? `${origin}/interview?id=${projectId}&pid=P-001` : '',
		project_title: 'Example project',
		opt_out_url: origin ? `${origin}/opt-out/P-001` : ''
	});

	function fill(template: string) {
		return template.replace(placeholderPattern(), (_, k) => sample[k as TemplatePlaceholder]);
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow">
	<div class="flex items-center justify-between border-b border-gray-200 px-3 py-2">
		<span class="text-sm font-semibold text-gray-700">Preview</span>
		<span class="text-xs text-gray-500">
			Sample: {sample.name} &middot; {sample.email} &middot; {sample.pid}
		</span>
	</div>
	<div class="px-3 py-2">
		{#if !subject && !html}
			<p class="text-sm text-gray-400">Nothing to preview yet.</p>
		{:else}
			{#if subject}
				<div class="mb-2 border-b border-gray-100 pb-2 text-sm">
					<span class="font-semibold text-gray-700">Subject:</span>
					<span class="text-gray-800">{fill(subject)}</span>
				</div>
			{/if}
			<div class="prose prose-sm max-w-none">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html fill(html)}
			</div>
		{/if}
	</div>
</div>
