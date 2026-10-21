<script lang="ts">
	/**
	 * Marks a preview feature, shown only to accounts with preview features
	 * turned on. Styled by `.preview-badge` in app.css, which tour popovers
	 * share. `compact` is a bare icon in the pill's colour instead, for the
	 * dark sidebar, where a pill is noise; on a hovered (white) row it takes the
	 * row's dark text colour.
	 */
	let { compact = false, class: className = '' }: { compact?: boolean; class?: string } = $props();

	const title = 'Preview feature';
</script>

{#if compact}
	<span class={['text-[0.7em] text-secondary [a:hover_&]:text-dark', className]} {title}>
		<i class="fa-solid fa-eye" aria-hidden="true"></i>
		<span class="sr-only">Preview</span>
	</span>
{:else}
	<span class={['preview-badge', className]} {title}>
		<i class="fa-solid fa-eye" aria-hidden="true"></i>
		Preview
	</span>
{/if}
