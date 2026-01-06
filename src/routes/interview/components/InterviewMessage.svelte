<script lang="ts">
	import SurveyItem from './SurveyItem.svelte';
	import FeedbackToggle from './FeedbackToggle.svelte';
	import SkipButton from './SkipButton.svelte';

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
</script>

<div
	class="group relative mb-[15px] flex w-full px-[10px] sm:px-[50px] {isReceived
		? 'items-start justify-start'
		: 'flex-col items-end justify-end'}"
>
	<!-- Message Content -->
	<div
		class="relative inline-block max-w-[90%] rounded-[10px] p-[10px] break-words hyphens-auto sm:max-w-[80%]
        {isReceived ? 'bg-[#eee] text-gray-900' : 'bg-[#007bff] text-white'}"
		{lang}
	>
		{#if message.image}
			<img
				src={message.image.data}
				alt={message.image.alt || 'Image'}
				class="max-h-[350px] max-w-full rounded-[5px] sm:max-h-[40vh]"
			/>
		{/if}
		{#if message.text}
			{@html message.text}
		{/if}
		{#if message.survey_item}
			<div class="mt-3 whitespace-normal">
				<SurveyItem
					{...message.survey_item}
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
