<script lang="ts">
	import type { PlatformRelease } from '$lib/api';
	import { whatsNew } from '$lib/whatsNew.svelte';
	import { fade, fly } from 'svelte/transition';

	let { releases = [] }: { releases?: PlatformRelease[] } = $props();

	const KIND_LABELS = {
		new: 'New',
		improved: 'Improved',
		fixed: 'Fixed'
	} as const;

	// Cream for new capabilities, muted green for the rest — the palette only
	// has the two accents, so kind is carried mostly by the label itself.
	const KIND_CLASSES = {
		new: 'bg-secondary text-on-secondary',
		improved: 'bg-primary/10 text-primary',
		fixed: 'bg-dark/10 text-dark/70'
	} as const;

	// Releases with nothing user-facing are filtered out by the API, but a
	// curated-then-emptied release would still arrive with no highlights.
	let shown = $derived(releases.filter((release) => release.highlights.length > 0));

	function formatDate(iso: string) {
		const parsed = new Date(iso);
		if (Number.isNaN(parsed.getTime())) return iso;
		return parsed.toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') whatsNew.close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if whatsNew.isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
		role="dialog"
		aria-modal="true"
		aria-labelledby="whats-new-title"
	>
		<!-- Backdrop -->
		<button
			class="fixed inset-0 h-full w-full cursor-default bg-dark/80 transition-opacity focus:outline-none"
			transition:fade={{ duration: 200 }}
			onclick={() => whatsNew.close()}
			aria-label="Close what's new"
			type="button"
		></button>

		<!-- Modal Panel -->
		<div
			class="relative flex max-h-[80vh] w-full max-w-lg transform flex-col overflow-hidden rounded-xl bg-light shadow-2xl transition-all"
			transition:fly={{ y: 20, duration: 300 }}
		>
			<div class="flex items-start justify-between border-b border-dark/10 px-6 py-4">
				<h2 id="whats-new-title" class="text-lg font-semibold text-dark">What's new</h2>
				<button
					type="button"
					class="rounded-md bg-light text-dark/50 hover:text-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
					onclick={() => whatsNew.close()}
					aria-label="Close"
				>
					<span class="fa-regular fa-circle-xmark text-xl"></span>
				</button>
			</div>

			<div class="overflow-y-auto px-6 py-5">
				{#each shown as release (release.platform_version)}
					<section class="mb-6 last:mb-0">
						<h3 class="mb-3 flex items-baseline justify-between gap-3">
							<span class="text-xs font-semibold tracking-wide text-dark/50 uppercase">
								{formatDate(release.released_at)}
							</span>
							<span class="text-[0.625rem] font-medium tracking-wide text-dark/35">
								v{release.platform_version}
							</span>
						</h3>
						<ul class="m-0 list-none space-y-4 p-0">
							{#each release.highlights as highlight, index (`${release.platform_version}-${index}`)}
								<li class="flex gap-3">
									<!-- Fixed width so every pill is the same size and the titles
									     beside them share one left edge, whatever the label.
									     self-start is load-bearing: without it the pill stretches to
									     the row's height, and rounded-full then renders it as a blob
									     next to any entry whose text wraps. -->
									<span
										class={[
											'mt-0.5 w-18 shrink-0 self-start rounded-full py-0.5 text-center text-xs font-medium',
											KIND_CLASSES[highlight.kind]
										].join(' ')}
									>
										{KIND_LABELS[highlight.kind]}
									</span>
									<div class="min-w-0">
										<p class="m-0 text-sm font-medium text-dark">{highlight.title}</p>
										{#if highlight.body}
											<p class="m-0 mt-1 text-sm text-dark/60">{highlight.body}</p>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					</section>
				{:else}
					<p class="m-0 py-6 text-center text-sm text-dark/60">
						Nothing new to report yet — updates will show up here.
					</p>
				{/each}
			</div>

			<div class="border-t border-dark/10 px-6 py-3 text-center">
				<a
					class="text-sm text-primary hover:underline"
					href="https://docs.ainterviewer.dk/releases/"
					target="_blank"
					rel="noopener"
				>
					Full release notes
					<span class="fa-solid fa-arrow-up-right-from-square ml-1 text-xs"></span>
				</a>
			</div>
		</div>
	</div>
{/if}
