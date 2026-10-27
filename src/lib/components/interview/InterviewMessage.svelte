<script lang="ts">
	import AudioMessage from './AudioMessage.svelte';
	import FeedbackToggle from './FeedbackToggle.svelte';
	import MessageBubble from './MessageBubble.svelte';
	import ReportButton from './ReportButton.svelte';
	import ReportIndicator from './ReportIndicator.svelte';
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
		// Whether this is the question the interview is waiting on and the
		// respondent may skip it; `InterviewChat` decides.
		skippable = false,
		readonly = false,
		onFeedback,
		onSkip,
		onReport = () => {},
		reportLabel = 'Report this question',
		onSurveyAnswer
	} = $props();

	let isReceived = $derived(message.type === 'received');
	// Only show controls for received messages that are not the intro (id > 1)
	let showControls = $derived(isReceived && message.message_id && Number(message.message_id) > 1);

	let showFeedbackIndicator = $derived(readonly && message.feedback);

	// What the respondent reported about this question, shown on the transcript
	// only: during the interview the report is the dialog's business and is not
	// drawn into the conversation the respondent is reading.
	let reports = $derived(message.reports ?? []);
	let showReportIndicator = $derived(readonly && reports.length > 0);
</script>

<MessageBubble
	interviewer={isReceived}
	text={message.text ?? ''}
	label={message.question_label ?? null}
	image={message.image ?? null}
	surveyItem={message.survey_item ?? null}
	answer={message.answer ?? ''}
	condition={message.condition ?? null}
	time={message.created_at ?? null}
	skipped={message.skipped_by_condition ?? false}
	readonly={readonly || message.skipped === true}
	{lang}
	onSurveyAnswer={(given: unknown) => onSurveyAnswer(given, message.message_id)}
>
	{#snippet media()}
		{#if message.audio}
			<AudioMessage blob={message.audio.blob} duration={message.audio.duration} />
		{/if}
	{/snippet}

	{#snippet controls()}
		{#if (showControls && !readonly) || showFeedbackIndicator || showReportIndicator}
			<div
				class="ml-2 items-center gap-2 self-center {showFeedbackIndicator || showReportIndicator
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
					{#if showReportIndicator}
						<ReportIndicator {reports} />
					{/if}
				{:else}
					<FeedbackToggle
						feedback={message.feedback}
						onFeedback={(f: 'positive' | 'negative' | null) => onFeedback(f, message.message_id)}
					/>
					<ReportButton label={reportLabel} onReport={() => onReport(message.message_id)} />
					{#if skippable}
						<SkipButton {onSkip} />
					{/if}
				{/if}
			</div>
		{/if}
	{/snippet}
</MessageBubble>
