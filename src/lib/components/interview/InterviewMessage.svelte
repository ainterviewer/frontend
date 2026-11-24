<script lang="ts">
	import { getUiText } from '$lib/respondentText';

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

	let chatText = $derived(getUiText(lang).chat);

	let isReceived = $derived(message.type === 'received');
	// Only show controls for received messages that are not the intro (id > 1)
	let showControls = $derived(isReceived && message.message_id && Number(message.message_id) > 1);

	let showFeedbackIndicator = $derived(readonly && message.feedback);

	// What the respondent reported about this question, shown on the transcript
	// only: during the interview the report is the dialog's business and is not
	// drawn into the conversation the respondent is reading.
	let reports = $derived(message.reports ?? []);
	let showReportIndicator = $derived(readonly && reports.length > 0);

	// A survey answered before -- replayed on resuming -- shows the answer it
	// was given and takes no other; one answered just now keeps its own.
	let locked = $derived(readonly || message.skipped === true || message.answer !== undefined);

	/**
	 * Tapped open, on a device that cannot hover.
	 *
	 * The controls appear on `group-hover`, which Tailwind applies only where
	 * the device can hover, so on a phone they never showed and a respondent
	 * could neither skip nor report. A tap on the message opens them instead,
	 * and a tap anywhere else closes them, so only one message has them open
	 * at a time.
	 *
	 * Listened for on the window rather than on the message, so a tap outside
	 * closes them with the same handler. `click` rather than `pointerdown`, so
	 * a swipe that starts on a bubble scrolls the chat and opens nothing.
	 */
	let revealed = $state(false);

	/**
	 * How the controls are kept out of sight until they are wanted: by hover,
	 * by a tap (`revealed`), or by keyboard focus.
	 *
	 * Never `hidden`, which would take the buttons out of the tab order and
	 * leave a keyboard user no way to skip or report. Instead, beside the
	 * bubble (`sm` up) they are transparent and let clicks through, so an
	 * invisible button cannot be tapped on a tablet; under it they are
	 * `sr-only`, out of the layout so every question is not followed by an
	 * empty row. Either way a button reached with Tab brings them into view.
	 * `focus-visible` rather than `focus-within`, so a button that keeps focus
	 * after a mouse click does not hold them open once the pointer has left.
	 */
	const CONCEALED =
		'flex max-sm:not-has-focus-visible:not-group-hover:sr-only sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:has-focus-visible:pointer-events-auto sm:has-focus-visible:opacity-100';
	let root: HTMLElement | undefined = $state();

	function onWindowClick(event: MouseEvent) {
		if (readonly || !showControls) return;
		if (!window.matchMedia('(hover: none)').matches) return;
		revealed = !revealed && root?.contains(event.target as Node) === true;
	}
</script>

<svelte:window onclick={onWindowClick} />

<!-- `contents`, so the wrapper is only something to ask `contains` of and the
     bubble lays out as if it were not there. -->
<div bind:this={root} class="contents">
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
		readonly={locked}
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
				<!-- Beside the bubble as an overlay from `sm` up, so the controls take
			     no width from it: in the flow, appearing on hover squeezed the
			     bubble and rewrapped the question being read. A phone has no room
			     beside a bubble, so there they sit under it, against its far edge:
			     the edge they sit beside on a wider screen. -->
				<div
					class="mt-2 items-center gap-2 self-end whitespace-nowrap sm:absolute sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 {isReceived
						? 'sm:left-full sm:ml-2'
						: 'sm:right-full sm:mr-2'} {showFeedbackIndicator || showReportIndicator || revealed
						? 'flex'
						: CONCEALED}"
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
							<SkipButton {onSkip} label={chatText.skip} title={chatText.skip_title} />
						{/if}
					{/if}
				</div>
			{/if}
		{/snippet}
	</MessageBubble>
</div>
