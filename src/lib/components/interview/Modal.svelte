<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A modal dialog in the interview: help, exit, and the report form.
	 *
	 * A native `<dialog>` opened with `showModal()`, because that is what a
	 * modal needs from the browser and cannot get from a `div`: focus moves in
	 * when it opens and back to the control that opened it when it closes, the
	 * page underneath is inert (Tab cannot wander into the chat behind it, and
	 * a screen reader does not read it), and Escape closes it.
	 *
	 * `show` is the caller's, and the dialog follows it. A dialog the browser
	 * closes itself, on Escape, reports that through `onClose` so the caller's
	 * `show` follows back.
	 */

	let {
		show = false,
		title,
		onClose,
		children
	}: {
		show?: boolean;
		title: string;
		onClose?: () => void;
		children: Snippet;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	const titleId = $props.id();

	$effect(() => {
		if (!dialog) return;
		if (show && !dialog.open) dialog.showModal();
		else if (!show && dialog.open) dialog.close();
	});

	/**
	 * A click on the backdrop closes the dialog.
	 *
	 * The backdrop belongs to the dialog element, so a click on it targets the
	 * dialog, but so does one on the dialog's own padding. Compared against the
	 * box instead, so only a click outside it counts.
	 */
	function onBackdropClick(event: MouseEvent) {
		if (!dialog || event.target !== dialog) return;
		const box = dialog.getBoundingClientRect();
		const inside =
			event.clientX >= box.left &&
			event.clientX <= box.right &&
			event.clientY >= box.top &&
			event.clientY <= box.bottom;
		if (!inside) onClose?.();
	}
</script>

<!-- Capped at the viewport, with the body scrolling under a fixed header: a
     long modal (the help text, on a phone) would otherwise grow past the
     screen and lose its close button off the top. The backdrop click has its
     keyboard counterpart in Escape, which the browser handles. -->
<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-2xl bg-white py-6 shadow-2xl ring-1 ring-black/5 backdrop:bg-black/50 backdrop:backdrop-blur-sm open:flex"
	onclick={onBackdropClick}
	onclose={() => {
		if (show) onClose?.();
	}}
>
	{#if show}
		<div
			class="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 pb-5 sm:px-10"
		>
			<h2 id={titleId} class="text-lg font-semibold text-gray-900">{title}</h2>
			<button
				type="button"
				class="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-500"
				onclick={onClose}
				aria-label="Close modal"
			>
				<i class="fa-solid fa-xmark text-lg"></i>
			</button>
		</div>
		<div class="min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 sm:px-10">
			{@render children()}
		</div>
	{/if}
</dialog>
