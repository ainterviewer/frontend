<script lang="ts" module>
	import type { ExportFormat } from './download';

	const FORMATS: { value: ExportFormat; label: string; description: string; icon: string }[] = [
		{ value: 'csv', label: 'CSV', description: 'Message table', icon: 'fa-file-csv' },
		{
			value: 'xlsx',
			label: 'Excel',
			description: 'Message table, a sheet per interview',
			icon: 'fa-file-excel'
		},
		{ value: 'docx', label: 'Word', description: 'Readable transcript', icon: 'fa-file-word' },
		{ value: 'pdf', label: 'PDF', description: 'Readable transcript', icon: 'fa-file-pdf' }
	];

	const STORAGE_KEY = 'interviewDownload';

	type Choice = { format: ExportFormat; archive: boolean };

	/** The last choice, so a repeated export is one click. */
	function loadChoice(): Choice {
		const fallback: Choice = { format: 'xlsx', archive: false };
		if (typeof localStorage === 'undefined') return fallback;
		try {
			const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Choice | null;
			return stored && FORMATS.some((f) => f.value === stored.format)
				? { format: stored.format, archive: !!stored.archive }
				: fallback;
		} catch {
			return fallback;
		}
	}
</script>

<script lang="ts">
	import { Dialog, RadioGroup } from 'bits-ui';

	let {
		open = $bindable(false),
		count,
		noun = 'interview',
		allowArchive = true,
		onDownload
	}: {
		open: boolean;
		/** How many interviews the download covers. */
		count: number;
		/** Singular, e.g. "test result". */
		noun?: string;
		/** Offer one file per interview in a ZIP. Pointless for a single interview. */
		allowArchive?: boolean;
		/** Resolves false when the download failed, which keeps the dialog open. */
		onDownload: (format: ExportFormat, archive: boolean) => Promise<boolean>;
	} = $props();

	const initial = loadChoice();
	let format = $state<ExportFormat>(initial.format);
	let archive = $state(initial.archive);
	let downloading = $state(false);

	const canArchive = $derived(allowArchive && count > 1);
	const zip = $derived(canArchive && archive);
	const label = $derived(FORMATS.find((f) => f.value === format)!.label);
	const summary = $derived(
		zip
			? `A ZIP with ${count} ${label} files`
			: count > 1
				? `One ${label} file with all ${count} ${noun}s`
				: `One ${label} file`
	);

	async function download() {
		downloading = true;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ format, archive }));
		} catch {
			// Remembering the choice is a convenience; never block the download on it.
		}
		const ok = await onDownload(format, zip);
		downloading = false;
		if (ok) open = false;
	}
</script>

<Dialog.Root
	bind:open={
		() => open,
		(value) => {
			// A large PDF export takes a while; closing would orphan it.
			if (!downloading) open = value;
		}
	}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-2000 bg-black/50 backdrop-blur-sm" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-2000 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg bg-white shadow-xl focus:outline-none"
		>
			<div class="flex items-center justify-between px-5 pt-4">
				<Dialog.Title class="text-lg font-semibold text-dark">
					Download {count}
					{count === 1 ? noun : `${noun}s`}
				</Dialog.Title>
				<Dialog.Close
					class="rounded p-1 text-gray-400 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-50"
					disabled={downloading}
					aria-label="Close"
				>
					<i class="fa-solid fa-xmark text-lg"></i>
				</Dialog.Close>
			</div>
			<Dialog.Description class="px-5 pt-1 text-sm text-gray-500">
				Tables carry every message with its metadata; transcripts read like the conversation.
			</Dialog.Description>

			<div class="space-y-4 px-5 py-4">
				<fieldset>
					<legend class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
						Format
					</legend>
					<RadioGroup.Root
						bind:value={() => format, (value) => (format = value as ExportFormat)}
						class="grid grid-cols-2 gap-2"
						disabled={downloading}
						aria-label="Format"
					>
						{#each FORMATS as option (option.value)}
							<RadioGroup.Item
								value={option.value}
								class="flex items-start gap-3 rounded-md border border-gray-200 p-3 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
							>
								<i class="fa-solid {option.icon} mt-0.5 text-lg text-primary"></i>
								<span>
									<span class="block text-sm font-medium text-dark">{option.label}</span>
									<span class="block text-xs text-gray-500">{option.description}</span>
								</span>
							</RadioGroup.Item>
						{/each}
					</RadioGroup.Root>
				</fieldset>

				{#if canArchive}
					<fieldset>
						<legend class="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
							Output
						</legend>
						<RadioGroup.Root
							bind:value={
								() => (archive ? 'zip' : 'single'), (value) => (archive = value === 'zip')
							}
							class="inline-flex rounded-md border border-gray-200 p-0.5 text-sm"
							orientation="horizontal"
							disabled={downloading}
							aria-label="Output"
						>
							{#each [{ value: 'single', label: 'One file' }, { value: 'zip', label: 'ZIP, a file per interview' }] as option (option.value)}
								<RadioGroup.Item
									value={option.value}
									class="rounded px-3 py-1 text-gray-600 hover:text-dark focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none data-[state=checked]:bg-primary data-[state=checked]:text-white"
								>
									{option.label}
								</RadioGroup.Item>
							{/each}
						</RadioGroup.Root>
					</fieldset>
				{/if}
			</div>

			<div
				class="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-3"
			>
				<span class="text-xs text-gray-500">{summary}</span>
				<div class="flex gap-2">
					<Dialog.Close
						class="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
						disabled={downloading}
					>
						Cancel
					</Dialog.Close>
					<button
						type="button"
						class="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-dark disabled:opacity-50"
						onclick={download}
						disabled={downloading}
					>
						{#if downloading}
							<i class="fa-solid fa-spinner fa-spin"></i>
							Preparing…
						{:else}
							<i class="fa-solid fa-download"></i>
							Download
						{/if}
					</button>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
