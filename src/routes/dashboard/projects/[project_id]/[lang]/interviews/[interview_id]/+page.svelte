<script lang="ts">
	import type { Image, MessagePublic } from '$lib/api';
	import type { Message } from '../../../../../../interview/chat.svelte';
	import InterviewMessage from '../../../../../../interview/components/InterviewMessage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Transform API messages to ChatClient Message format
	let messages = $derived.by(() => {
		if (!data.messages) return [];

		return (data.messages as MessagePublic[]).map((msg) => {
			// Determine message type based on role
			let type: 'sent' | 'received' | 'system' = 'system';
			if (msg.role === 'user') type = 'sent';
			else if (msg.role === 'assistant') type = 'received';

			// Handle image
			let image: { data: string; alt?: string; primer?: string } | undefined = undefined;
			if (msg.image) {
				if (Array.isArray(msg.image)) {
					if (msg.image.length > 0) {
						// Assuming first image if array
						const img = msg.image[0];
						if (img.data) {
							image = {
								data: img.data,
								alt: img.alt,
								primer: img.primer || undefined
							};
						}
					}
				} else {
					const img = msg.image as Image;
					if (img.data) {
						image = {
							data: img.data,
							alt: img.alt,
							primer: img.primer || undefined
						};
					}
				}
			}

			return {
				id: msg.id,
				text: msg.content,
				type,
				message_id: msg.message_id,
				feedback: msg.feedback,
				survey_item: msg.survey_item,
				image: image,
				can_answer: msg.can_answer,
				user_image: false, // Default to false for history view
				options: undefined,
				required: false
			} as Message;
		});
	});
</script>

<div
	class="flex h-[calc(100vh-9rem)] w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
>
	<!-- Header -->
	<header class="flex items-center justify-between border-b px-6 py-4">
		<div class="flex items-center gap-4">
			<a
				href="/dashboard/projects/{data.project_id}/{data.lang}/interviews"
				class="text-gray-500 transition-colors hover:text-gray-700"
				aria-label="Back to interviews"
			>
				<i class="fa-solid fa-arrow-left text-lg"></i>
			</a>
			<div class="flex flex-col">
				<h1 class="text-xl font-semibold text-gray-800">Interview Transcript</h1>
				<span class="text-sm text-gray-500">ID: {data.interview_id}</span>
			</div>
		</div>
	</header>

	<!-- Messages Area -->
	<div class="flex-1 overflow-y-auto bg-gray-50 p-4">
		<div class="mx-auto min-h-full max-w-3xl rounded-lg bg-white p-6 shadow-sm">
			{#if data.error}
				<div class="rounded-md bg-red-50 p-4 text-center text-red-700">
					<p>{data.error}</p>
				</div>
			{:else if messages.length === 0}
				<div class="flex h-full flex-col items-center justify-center text-gray-500">
					<i class="fa-regular fa-comments mb-3 text-3xl"></i>
					<p>No messages found for this interview.</p>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					{#each messages as msg (msg.message_id || msg.id)}
						<div
							class={msg.type === 'system'
								? 'my-2 text-center text-sm text-gray-500 select-none'
								: ''}
						>
							{#if msg.type === 'system'}
								{msg.text}
							{:else}
								<InterviewMessage
									message={msg}
									lang={data.lang}
									isLast={false}
									readonly={true}
									onFeedback={() => {}}
									onSkip={() => {}}
									onSurveyAnswer={() => {}}
								/>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
