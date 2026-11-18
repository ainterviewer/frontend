<script lang="ts">
	import { getUiText } from '$lib/respondentText/ui';

	interface Props {
		text: string;
		lang: string;
		onClose: () => void;
	}

	let { text, lang, onClose }: Props = $props();

	const closeText = $derived(getUiText(lang).chat.dismiss_notice);

	/** Focus the button, so the dialog can be closed by keyboard. */
	function focus(node: HTMLButtonElement) {
		node.focus();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!--
	A timed message the guide shows in a modal instead of the chat. The
	interview does not wait on it being closed.
-->
<div
	class="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
	role="alertdialog"
	aria-modal="true"
	aria-describedby="timed-message-text"
>
	<div
		class="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5"
	>
		<p id="timed-message-text" class="text-sm whitespace-pre-line text-gray-700">{text}</p>
		<div class="mt-6 flex justify-end">
			<button
				type="button"
				class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
				onclick={onClose}
				{@attach focus}
			>
				{closeText}
			</button>
		</div>
	</div>
</div>
