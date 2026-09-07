<script lang="ts">
	import type { CustomToken } from '$lib/api';
	import { sanitizeMarkup } from '$lib/utils/sanitize';
	import AudioMessage from './AudioMessage.svelte';
	import FeedbackToggle from './FeedbackToggle.svelte';
	import SkipButton from './SkipButton.svelte';
	import SurveyItem from './SurveyItem.svelte';

	// Custom token definitions with their display properties
	const TOKEN_CONFIG: Record<
		CustomToken,
		{ icon: string; label: string; color: string; justify: string }
	> = {
		'<|endofprobe|>': {
			icon: 'fa-solid fa-check',
			label: 'Probe complete',
			color: 'text-blue-600 bg-blue-50',
			justify: 'center'
		},
		'<|endofsection|>': {
			icon: 'fa-solid fa-flag-checkered',
			label: 'Section complete',
			color: 'text-green-600 bg-green-50',
			justify: 'center'
		},
		'<|endofinterview|>': {
			icon: 'fa-solid fa-circle-check',
			label: 'Interview complete',
			color: 'text-emerald-600 bg-emerald-50',
			justify: 'center'
		},
		'<|skipquestion|>': {
			icon: 'fa-solid fa-forward',
			label: 'Question skipped',
			color: 'text-gray-600',
			justify: 'end'
		},
		'<|skipsection|>': {
			icon: 'fa-solid fa-forward-fast',
			label: 'Section skipped',
			color: 'text-amber-600 bg-amber-50',
			justify: 'center'
		},
		'<|noanswer|>': {
			icon: 'fa-solid fa-minus',
			label: 'No answer',
			color: 'text-gray-500 bg-gray-100',
			justify: 'center'
		},
		'<|restartinterview|>': {
			icon: 'fa-solid fa-rotate',
			label: 'Interview restarted',
			color: 'text-purple-600 bg-purple-50',
			justify: 'center'
		}
	};

	const TOKEN_PATTERN =
		/<\|(endofprobe|endofsection|endofinterview|skipquestion|skipsection|noanswer|restartinterview)\|>/;

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

	// Check if the message text is exactly a custom token
	let customToken = $derived.by(() => {
		if (!message.text) return null;
		const trimmed = message.text.trim();
		if (trimmed in TOKEN_CONFIG) {
			return TOKEN_CONFIG[trimmed as CustomToken];
		}
		return null;
	});

	// Check if message contains tokens mixed with other text
	let hasEmbeddedTokens = $derived(
		message.text && !customToken && TOKEN_PATTERN.test(message.text)
	);

	// Interviewer text is written by the project's collaborators in the
	// interview guide and may contain markup -- an outro that links to a
	// support page, say -- so it is sanitised down to an inline allowlist.
	// Respondent text is untrusted input and is rendered as text, never markup.
	let allowMarkup = $derived(isReceived);

	// Split the text into plain runs and embedded tokens, so the tokens can be
	// rendered as elements. Each run is sanitised on its own, which keeps the
	// emitted markup balanced around the token badges.
	type TextSegment =
		| { kind: 'text'; value: string; html: string | null }
		| { kind: 'token'; config: (typeof TOKEN_CONFIG)[CustomToken] };

	function textSegment(value: string): TextSegment {
		return { kind: 'text', value, html: allowMarkup ? sanitizeMarkup(value) : null };
	}

	let textSegments = $derived.by((): TextSegment[] => {
		const text: string = message.text ?? '';
		if (!text) return [];
		if (!hasEmbeddedTokens) return [textSegment(text)];

		const segments: TextSegment[] = [];
		let cursor = 0;
		for (const match of text.matchAll(new RegExp(TOKEN_PATTERN.source, 'g'))) {
			const config = TOKEN_CONFIG[match[0] as CustomToken];
			if (!config || match.index === undefined) continue;
			if (match.index > cursor) {
				segments.push(textSegment(text.slice(cursor, match.index)));
			}
			segments.push({ kind: 'token', config });
			cursor = match.index + match[0].length;
		}
		if (cursor < text.length) segments.push(textSegment(text.slice(cursor)));
		return segments;
	});
</script>

{#if customToken}
	<!-- Custom Token Display (standalone token message) -->
	<div
		class="mb-[15px] flex w-full justify-{customToken.justify} px-[10px] sm:px-[50px] {message.skipped_by_condition
			? 'opacity-50'
			: ''}"
	>
		<div
			class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium {customToken.color}"
		>
			<i class={customToken.icon}></i>
			<span>{customToken.label}</span>
		</div>
	</div>
{:else}
	<div
		class="group relative mb-[15px] flex w-full px-[10px] sm:px-[50px] {isReceived
			? 'items-start justify-start'
			: 'flex-col items-end justify-end'} {message.skipped_by_condition ? 'opacity-50' : ''}"
	>
		<!-- Message Content -->
		<div
			class="relative inline-block max-w-[90%] rounded-xl break-words hyphens-auto sm:max-w-[80%]
      {isReceived
				? 'rounded-bl-sm bg-[#eee] p-2.5 text-gray-900'
				: message.survey_item
					? ''
					: 'rounded-br-sm bg-primary p-2.5 text-white'}"
			{lang}
		>
			{#if message.question_label}
				<div class="mb-1 text-xs font-bold opacity-60">
					{message.question_label}
				</div>
			{/if}
			{#if message.image}
				<img
					src={message.image.data}
					alt={message.image.alt || 'Image'}
					class="max-h-[350px] max-w-full rounded-[5px] sm:max-h-[40vh]"
				/>
			{/if}
			{#if message.audio}
				<AudioMessage blob={message.audio.blob} duration={message.audio.duration} />
			{/if}
			{#if textSegments.length}
				<!-- Tailwind's preflight strips link styling, and sanitised markup is
				     outside the reach of scoped CSS, so style anchors from here. -->
				<span
					class="whitespace-pre-wrap [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2"
				>
					{#each textSegments as segment, i (i)}
						{#if segment.kind === 'token'}
							<span
								class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium {segment
									.config.color}"
							>
								<i class={segment.config.icon}></i>
								{segment.config.label}
							</span>
						{:else if segment.html !== null}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html segment.html}
						{:else}{segment.value}{/if}
					{/each}
				</span>
			{/if}
			{#if message.survey_item}
				<div class="whitespace-normal">
					<SurveyItem
						{...message.survey_item}
						{lang}
						{readonly}
						answer={message.answer}
						onAnswer={(ans: unknown) => onSurveyAnswer(ans, message.message_id)}
					/>
				</div>
			{/if}
		</div>

		<!-- Controls (only for received) -->
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
					{#if isLast}
						<SkipButton {onSkip} />
					{/if}
				{/if}
			</div>
		{/if}
	</div>
{/if}
