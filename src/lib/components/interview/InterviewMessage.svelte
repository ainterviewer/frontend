<script lang="ts">
	import type { CustomToken } from '$lib/api';
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

	// Process text to replace embedded tokens with styled badges
	function processTextWithTokens(text: string): string {
		return text.replace(new RegExp(TOKEN_PATTERN.source, 'g'), (match) => {
			const config = TOKEN_CONFIG[match as CustomToken];
			if (!config) return match;
			return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}"><i class="${config.icon}"></i> ${config.label}</span>`;
		});
	}

	let processedText = $derived.by(() => {
		let text = hasEmbeddedTokens ? processTextWithTokens(message.text) : message.text;
		if (text) text = text.replace(/\n/g, '<br>');
		return text;
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
			{#if processedText}
				{@html processedText}
			{/if}
			{#if message.survey_item}
				<div class="whitespace-normal">
					<SurveyItem
						{...message.survey_item}
						{lang}
						{readonly}
						answer={message.answer}
						onAnswer={(ans: any) => onSurveyAnswer(ans, message.message_id)}
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
						onFeedback={(f: any) => onFeedback(f, message.message_id)}
					/>
					{#if isLast}
						<SkipButton {onSkip} />
					{/if}
				{/if}
			</div>
		{/if}
	</div>
{/if}
