<script lang="ts">
	import type { SecurityOverride } from '$lib/api';

	import type { PendingIntervention } from '../../../routes/interview/chat.svelte';
	import { getSecurityText } from './securityText';

	interface Props {
		intervention: PendingIntervention;
		lang: string;
		/** The respondent's answer, when they may override the intervention. */
		onRespond: (choice: SecurityOverride) => void;
		/** Closes an intervention the respondent cannot override. */
		onDismiss: () => void;
	}

	let { intervention, lang, onRespond, onDismiss }: Props = $props();

	const text = $derived(getSecurityText(lang));

	/** Focus the primary button, so the dialog can be answered by keyboard. */
	function focus(node: HTMLButtonElement) {
		node.focus();
	}
</script>

<!--
	Deliberately not a Modal: Modal is dismissable, and an intervention the
	respondent may override has to be answered -- the interview waits on it.
-->
<div
	class="fixed inset-0 z-100 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
	role="alertdialog"
	aria-modal="true"
	aria-labelledby="security-intervention-title"
	aria-describedby="security-intervention-text"
>
	<div
		class="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5"
	>
		<div class="flex gap-4">
			<div
				class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100"
			>
				<i class="fa-solid fa-shield-heart text-amber-600"></i>
			</div>
			<div>
				<h2 id="security-intervention-title" class="text-lg font-semibold text-gray-900">
					{text.title}
				</h2>
				<p id="security-intervention-text" class="mt-2 text-sm whitespace-pre-line text-gray-600">
					{intervention.text}
				</p>
			</div>
		</div>

		<div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			{#if intervention.respondent_override}
				<button
					type="button"
					class="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-300 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
					onclick={() => onRespond('override')}
				>
					{text.override[intervention.action]}
				</button>
				<button
					type="button"
					class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
					onclick={() => onRespond('accept')}
					{@attach focus}
				>
					{text.accept[intervention.action]}
				</button>
			{:else}
				<button
					type="button"
					class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
					onclick={onDismiss}
					{@attach focus}
				>
					{text.acknowledge}
				</button>
			{/if}
		</div>
	</div>
</div>
