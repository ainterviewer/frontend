<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	interface Props {
		show: boolean;
		title: string;
		text: string;
		videoUrl?: string | null;
		email?: string | null;
		interviewId?: string | null;
		buttonText?: string;
		onProceed: () => void;
		onClose?: () => void;
		isPreview?: boolean;
		animate?: boolean;
	}

	let {
		show = false,
		title,
		text,
		videoUrl = null,
		email = null,
		interviewId = null,
		buttonText = 'Start Interview',
		onProceed,
		onClose,
		isPreview = false,
		animate = true
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && show && onClose) {
			onClose();
		}
	}

	function handleProceed() {
		if (isPreview && onClose) {
			onClose();
		} else {
			onProceed();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<div
		class="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="welcome-modal-title"
	>
		{#if isPreview}
			<button
				class="fixed inset-0 h-full w-full cursor-default bg-dark/80 transition-opacity focus:outline-none"
				in:fade={{ duration: 200 }}
				out:fade={{ duration: animate ? 200 : 0 }}
				onclick={onClose}
				aria-label="Close modal"
				type="button"
			></button>
		{/if}

		<div
			class="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
			in:fly={{ y: 20, duration: 300 }}
			out:fly={{ y: 20, duration: animate ? 300 : 0 }}
		>
			{#if isPreview && onClose}
				<div class="absolute top-0 right-0 z-10 pt-4 pr-4">
					<button
						type="button"
						class="rounded-md bg-white text-gray-400 hover:text-gray-600 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
						onclick={onClose}
					>
						<span class="sr-only">Close</span>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			{/if}

			<div class="max-h-[calc(100vh-120px)] overflow-y-auto px-6 py-8 sm:p-10">
				<h2 id="welcome-modal-title" class="text-2xl font-bold tracking-tight text-gray-900">
					{title || 'Welcome Title'}
				</h2>

				{#if videoUrl}
					<div class="mt-4 overflow-hidden rounded-lg bg-black">
						<video controls class="w-full">
							<source src={videoUrl} type="video/mp4" />
							Your browser does not support the video tag.
						</video>
					</div>
				{/if}

				<div class="mt-4 leading-relaxed text-gray-700">
					{#if text}
						{text}
					{:else if isPreview}
						<span class="text-gray-400 italic">No welcome message configured yet.</span>
					{/if}
				</div>

				{#if email}
					<hr class="my-6 border-gray-200" />
					<div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
						<p class="mb-2">
							If you wish to withdraw your consent or change your answers, please contact
							<a href="mailto:{email}" class="font-medium text-primary hover:underline">
								{email}
							</a>
							with a reference to the following code:
						</p>
						<div
							class="my-2 flex w-fit items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
						>
							<code class="font-mono text-sm text-gray-700">{interviewId || '<interview-id>'}</code>
							<i class="fa-solid fa-fingerprint text-gray-400"></i>
						</div>
						<p class="text-xs text-gray-500">
							It is your own responsibility to store this code securely before starting the
							interview. It is the only way for us to identify and modify or delete your data.
						</p>
					</div>
				{/if}

				<div class="mt-8">
					<button
						onclick={handleProceed}
						disabled={isPreview ? false : undefined}
						class="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
					>
						{buttonText}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
