<script lang="ts">
	import AudioMessage from './AudioMessage.svelte';
	import FeedbackToggle from './FeedbackToggle.svelte';
	import MessageBubble from './MessageBubble.svelte';
	import SkipButton from './SkipButton.svelte';

	/**
	 * A message in the live interview and on the transcript page.
	 *
	 * The bubble itself is `MessageBubble`, shared with the explore view — what
	 * is left here is everything that only makes sense while an interview is
	 * running or being reviewed: the feedback thumbs, the skip button, and the
	 * recorded audio a transcribed answer came from.
	 */

	let {
		message,
		lang = 'en',
		isLast = false,
		readonly = false,
		onFeedback,
		onSkip,
		onSurveyAnswer
	} = $props();

	let isReceived = $derived(message.type === 'received');
	// Only show controls for received messages that are not the intro (id > 1)
	let showControls = $derived(isReceived && message.message_id && Number(message.message_id) > 1);

	let showFeedbackIndicator = $derived(readonly && message.feedback);

	/**
	 * Whether there is anything here to skip.
	 *
	 * A guide message with `can_answer: false` is something the interviewer
	 * says, not something it asks — a section intro, a hand-off — and the
	 * respondent is given no input for it. Offering "Skip" on one invites them
	 * to skip a question that was never put to them, and the next message
	 * arrives on its own regardless.
	 *
	 * The same test the socket uses to decide whether to enable the input, so
	 * the button and the textbox appear and disappear together rather than each
	 * having its own idea of what can be answered.
	 */
	let answerable = $derived(message.can_answer !== false);
</script>

<MessageBubble
	interviewer={isReceived}
	text={message.text ?? ''}
	label={message.question_label ?? null}
	image={message.image ?? null}
	surveyItem={message.survey_item ?? null}
	answer={message.answer ?? ''}
	condition={message.condition ?? null}
	skipped={message.skipped_by_condition ?? false}
	{readonly}
	{lang}
	onSurveyAnswer={(given: unknown) => onSurveyAnswer(given, message.message_id)}
>
	{#snippet media()}
		{#if message.audio}
			<AudioMessage blob={message.audio.blob} duration={message.audio.duration} />
		{/if}
	{/snippet}

	{#snippet controls()}
		{#if (showControls && !readonly) || showFeedbackIndicator}
			<div
				class="ml-2 items-center gap-2 self-center {showFeedbackIndicator
					? 'flex'
					: 'hidden group-hover:flex'}"
			>
				{#if readonly}
					{#if message.feedback === 'positive'}
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600"
							title="Positive feedback"
						>
							<i class="fa-solid fa-thumbs-up"></i>
						</div>
					{:else if message.feedback === 'negative'}
						<div
							class="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600"
							title="Negative feedback"
						>
							<i class="fa-solid fa-thumbs-down"></i>
						</div>
					{/if}
				{:else}
					<FeedbackToggle
						feedback={message.feedback}
						onFeedback={(f: 'positive' | 'negative' | null) => onFeedback(f, message.message_id)}
					/>
					{#if isLast && answerable}
						<SkipButton {onSkip} />
					{/if}
				{/if}
			</div>
		{/if}
	{/snippet}
</MessageBubble>
