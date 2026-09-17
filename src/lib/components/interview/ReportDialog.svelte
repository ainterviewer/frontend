<script lang="ts">
	import type { ReportReason } from '$lib/api';
	import { REPORT_REASONS, type ReportText } from '../../../routes/interview/reportText';
	import Modal from './Modal.svelte';

	/**
	 * The respondent's report of one interviewer question.
	 *
	 * Two steps in one dialog. First the reason and an optional note; then, once
	 * the report is stored, an acknowledgement — and only there the offer to
	 * skip the question, which the respondent may decline. Reporting and
	 * skipping are deliberately not the same act: a respondent who says a
	 * question is offensive has not thereby asked to be moved past it, and a
	 * dialog that skipped on their behalf would put words in their mouth.
	 *
	 * `canSkip` is the caller's: the skip control message applies to whatever
	 * question the interview is waiting on, so offering it against an earlier
	 * question in the transcript would skip the wrong one.
	 */

	interface Props {
		show: boolean;
		text: ReportText;
		/** False when the reported question is not the one awaiting an answer. */
		canSkip: boolean;
		onSubmit: (reason: ReportReason, comment: string | null) => Promise<boolean>;
		onSkip: () => void;
		onClose: () => void;
	}

	let { show, text, canSkip, onSubmit, onSkip, onClose }: Props = $props();

	type Step = 'form' | 'sent';

	let step = $state<Step>('form');
	let reason = $state<ReportReason | null>(null);
	let comment = $state('');
	let submitting = $state(false);
	let failed = $state(false);

	// A reason is enough on its own, except for `other`, which says nothing
	// without the note — the same reasoning as the backend's comment handling.
	let submittable = $derived(
		reason !== null && (reason !== 'other' || comment.trim().length > 0) && !submitting
	);

	/**
	 * Return the dialog to its opening state.
	 *
	 * Called when it closes rather than when it opens: the dialog is one
	 * instance reused for every question, so a report left on screen would
	 * otherwise reappear — with its reason still selected — against whatever
	 * question was flagged next.
	 */
	function reset() {
		step = 'form';
		reason = null;
		comment = '';
		submitting = false;
		failed = false;
	}

	function close() {
		onClose();
		reset();
	}

	async function submit() {
		if (!submittable || reason === null) return;

		submitting = true;
		failed = false;

		const ok = await onSubmit(reason, comment.trim() || null);

		submitting = false;

		if (ok) {
			step = 'sent';
		} else {
			// Kept on the form with the reason and note intact: the report has
			// not been stored, and clearing what they wrote would make trying
			// again a retyping exercise.
			failed = true;
		}
	}

	function skip() {
		onSkip();
		close();
	}
</script>

<Modal {show} title={text.title} onClose={close}>
	{#if step === 'form'}
		<p class="text-sm text-gray-600">{text.intro}</p>

		<fieldset class="mt-5">
			<legend class="sr-only">{text.title}</legend>
			<div class="flex flex-col gap-2">
				{#each REPORT_REASONS as value (value)}
					<label
						class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all
						{reason === value
							? 'border-primary bg-primary/10 text-dark ring-1 ring-primary'
							: 'border-gray-200 text-gray-700 hover:border-primary/50 hover:bg-gray-50'}"
					>
						<!-- The same classes the survey items use: `accent-*` leaves
						     the control on the browser's own blue. -->
						<input
							type="radio"
							name="report-reason"
							class="h-4 w-4 border-gray-300 bg-white text-primary checked:border-primary checked:bg-primary focus:ring-primary"
							{value}
							bind:group={reason}
						/>
						<span>{text.reasons[value]}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<label class="mt-5 block">
			<span class="text-sm font-medium text-gray-700">{text.comment_label}</span>
			<textarea
				bind:value={comment}
				rows="3"
				maxlength="2000"
				placeholder={text.comment_placeholder}
				class="mt-2 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
			></textarea>
		</label>

		<!--
			One fixed-height slot for whichever of the two messages applies.
			Rendered whether or not there is anything to say: growing it on
			demand moved the whole dialog under the pointer the moment
			"Something else" was picked, and the space between the textarea and
			the buttons is there to be used either way.
		-->
		<div class="mt-2 min-h-8 text-xs" aria-live="polite">
			{#if failed}
				<p class="text-red-600" role="alert">{text.error}</p>
			{:else if reason === 'other' && comment.trim().length === 0}
				<p class="text-gray-500">{text.comment_required_hint}</p>
			{/if}
		</div>

		<div class="flex justify-end gap-3 pb-1">
			<button
				type="button"
				class="rounded-full px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
				onclick={close}
			>
				{text.cancel}
			</button>
			<button
				type="button"
				class="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
				disabled={!submittable}
				onclick={submit}
			>
				{submitting ? text.submitting : text.submit}
			</button>
		</div>
	{:else}
		<div class="flex items-start gap-3">
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600"
			>
				<i class="fa-solid fa-check"></i>
			</div>
			<div>
				<h3 class="text-sm font-semibold text-gray-900">{text.thanks_title}</h3>
				<p class="mt-1 text-sm text-gray-600">{text.thanks_text}</p>
			</div>
		</div>

		{#if canSkip}
			<p class="mt-5 text-sm text-gray-700">{text.skip_prompt}</p>
			<div class="mt-4 flex justify-end gap-3 pb-1">
				<button
					type="button"
					class="rounded-full px-5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
					onclick={close}
				>
					{text.skip_decline}
				</button>
				<button
					type="button"
					class="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
					onclick={skip}
				>
					{text.skip_confirm}
				</button>
			</div>
		{:else}
			<div class="mt-6 flex justify-end pb-1">
				<button
					type="button"
					class="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
					onclick={close}
				>
					{text.close}
				</button>
			</div>
		{/if}
	{/if}
</Modal>
