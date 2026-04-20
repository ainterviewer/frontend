<script lang="ts">
	import { fade, fly } from 'svelte/transition';

	interface Props {
		show: boolean;
		title: string;
		text: string;
		onAccept: () => void;
		onDecline: () => void;
		accepting?: boolean;
		onClose?: () => void;
		isPreview?: boolean;
		animate?: boolean;
	}

	let {
		show = false,
		title,
		text,
		onAccept,
		onDecline,
		accepting = false,
		onClose,
		isPreview = false,
		animate = true
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && show && onClose) {
			onClose();
		}
	}

	function handleAccept() {
		if (isPreview && onClose) {
			onClose();
		} else {
			onAccept();
		}
	}

	function handleDecline() {
		if (isPreview && onClose) {
			onClose();
		} else {
			onDecline();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<div
		class="fixed inset-0 z-200 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="consent-modal-title"
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
			class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
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
				<h2 id="consent-modal-title" class="text-2xl font-bold tracking-tight text-gray-900">
					{title || 'Consent Title'}
				</h2>
				<div class="mt-4 leading-relaxed text-gray-700">
					{#if text}
						{text}
					{:else if isPreview}
						<span class="text-gray-400 italic">No consent message configured yet.</span>
					{/if}
				</div>
				<div class="mt-8 flex gap-3">
					<button
						onclick={handleAccept}
						disabled={accepting}
						class="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-dark focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:opacity-50"
					>
						{#if accepting}
							<i class="fa-solid fa-spinner fa-spin mr-2"></i>
						{/if}
						Accept
					</button>
					<button
						onclick={handleDecline}
						disabled={accepting}
						class="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
					>
						Decline
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
