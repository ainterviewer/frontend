<script lang="ts">
	import { fly } from 'svelte/transition';

	interface Props {
		show: boolean;
		languages: Array<{ name: string; code: string }>;
		onSelect: (code: string) => void;
		animate?: boolean;
	}

	let { show = false, languages, onSelect, animate = false }: Props = $props();
</script>

{#if show}
	<div
		class="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="language-picker-title"
	>
		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
			in:fly={{ y: 20, duration: 300 }}
			out:fly={{ y: 20, duration: animate ? 300 : 0 }}
		>
			<div class="max-h-[calc(100vh-120px)] overflow-y-auto px-6 py-8 sm:p-10">
				<h2 id="language-picker-title" class="text-2xl font-bold tracking-tight text-gray-900">
					Select your language
				</h2>
				<div class="mt-6 flex flex-col gap-3">
					{#each languages as language (language.code)}
						<button
							type="button"
							class="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
							onclick={() => onSelect(language.code)}
						>
							{language.name}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
