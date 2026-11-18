<script lang="ts">
	import type { InterviewSummaryPublic } from '$lib/api';

	/** The guide version an interview ran, named the way the version history names it. */
	let { interview }: { interview: InterviewSummaryPublic } = $props();

	const name = $derived(
		interview.semver
			? `v${interview.semver}`
			: interview.version_no != null
				? `#${interview.version_no}`
				: null
	);

	const title = $derived(
		[
			interview.semver
				? `Published version ${interview.semver}`
				: `Snapshot #${interview.version_no} of the draft`,
			interview.version_label
		]
			.filter(Boolean)
			.join(': ')
	);
</script>

{#if name}
	<span class="font-mono text-xs" {title}>{name}</span>
{:else}
	<span
		class="text-gray-300"
		title="Ran before guide versions were kept, or its snapshot has been deleted"
	>
		&ndash;
	</span>
{/if}
