<script lang="ts">
	import { page } from '$app/state';
	import type { PdfToggles } from './exportPdf';

	let {
		open = $bindable(),
		exporting = false,
		onExport
	}: {
		open: boolean;
		exporting?: boolean;
		onExport: (toggles: PdfToggles) => Promise<void> | void;
	} = $props();

	const defaultToggles = (): PdfToggles => ({
		consent: true,
		welcome: true,
		framing: true,
		introduction: true,
		questionSections: true,
		aiGenerated: true,
		outro: true,
		timedMessages: true,
		behaviorFlags: true,
		conditions: true
	});

	const storageKey = $derived(`exportPdfToggles:${page.params.project_id ?? 'unknown'}`);

	function loadToggles(key: string): PdfToggles {
		if (typeof sessionStorage === 'undefined') return defaultToggles();
		try {
			const raw = sessionStorage.getItem(key);
			if (!raw) return defaultToggles();
			const parsed = JSON.parse(raw) as Partial<PdfToggles>;
			return { ...defaultToggles(), ...parsed };
		} catch {
			return defaultToggles();
		}
	}

	let toggles = $state<PdfToggles>(defaultToggles());

	$effect(() => {
		if (open) toggles = loadToggles(storageKey);
	});

	$effect(() => {
		if (!open) return;
		if (typeof sessionStorage === 'undefined') return;
		try {
			sessionStorage.setItem(storageKey, JSON.stringify(toggles));
		} catch {
			// ignore
		}
	});

	const items: { key: keyof PdfToggles; label: string; description: string }[] = [
		{ key: 'consent', label: 'Consent', description: 'Consent title and message.' },
		{ key: 'welcome', label: 'Welcome', description: 'Welcome title, message, and contact email.' },
		{ key: 'framing', label: 'Framing', description: 'AI-only context for the interview.' },
		{
			key: 'introduction',
			label: 'Introduction',
			description: 'First message shown to the interviewee.'
		},
		{
			key: 'questionSections',
			label: 'Question sections',
			description: 'All question sections with probes, survey items, and images.'
		},
		{
			key: 'aiGenerated',
			label: 'AI-generated questions & sections',
			description: 'Counts of questions and sections the AI generates on the fly during interviews.'
		},
		{ key: 'outro', label: 'Outro', description: 'Last message shown to the interviewee.' },
		{
			key: 'timedMessages',
			label: 'Timed messages',
			description: 'Scheduled messages during the interview.'
		},
		{
			key: 'behaviorFlags',
			label: 'Behavior flags',
			description: 'Per-question settings such as can_skip, shuffle, exclude_from_history.'
		},
		{
			key: 'conditions',
			label: 'Conditions',
			description: 'Branching logic attached to questions.'
		}
	];

	async function handleExport() {
		await onExport($state.snapshot(toggles));
	}

	function selectAll(value: boolean) {
		toggles = {
			consent: value,
			welcome: value,
			framing: value,
			introduction: value,
			questionSections: value,
			aiGenerated: value,
			outro: value,
			timedMessages: value,
			behaviorFlags: value,
			conditions: value
		};
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget && !exporting) open = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape' && !exporting) open = false;
		}}
	>
		<div class="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
			<div class="flex items-center justify-between p-4">
				<h3 class="text-lg font-semibold">Export PDF</h3>
				<button
					class="text-gray-400 hover:text-gray-600 disabled:opacity-50"
					onclick={() => (open = false)}
					disabled={exporting}
					aria-label="Close modal"
				>
					<i class="fa-solid fa-xmark text-xl"></i>
				</button>
			</div>

			<div class="px-4 pb-2 text-sm text-gray-600">
				Choose which sections to include in the exported PDF.
			</div>

			<div class="flex gap-4 px-4 pb-2 text-xs">
				<button
					class="text-primary hover:underline disabled:opacity-50"
					onclick={() => selectAll(true)}
					disabled={exporting}
				>
					Select all
				</button>
				<button
					class="text-gray-500 hover:underline disabled:opacity-50"
					onclick={() => selectAll(false)}
					disabled={exporting}
				>
					Deselect all
				</button>
			</div>

			<div class="max-h-96 overflow-y-auto px-4 pb-4">
				<ul class="space-y-2">
					{#each items as item (item.key)}
						<li>
							<label
								class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:bg-gray-50"
							>
								<input
									type="checkbox"
									class="mt-1 rounded border-gray-300 text-primary focus:ring-primary"
									bind:checked={toggles[item.key]}
									disabled={exporting}
								/>
								<span>
									<span class="block text-sm font-medium text-gray-800">{item.label}</span>
									<span class="block text-xs text-gray-500">{item.description}</span>
								</span>
							</label>
						</li>
					{/each}
				</ul>
			</div>

			<div class="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3">
				<button
					type="button"
					class="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
					onclick={() => (open = false)}
					disabled={exporting}
				>
					Cancel
				</button>
				<button
					type="button"
					class="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-dark disabled:opacity-50"
					onclick={handleExport}
					disabled={exporting}
				>
					{#if exporting}
						<i class="fa-solid fa-spinner fa-spin"></i>
						Exporting...
					{:else}
						<i class="fa-solid fa-file-export"></i>
						Export
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
