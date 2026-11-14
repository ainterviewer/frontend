<script lang="ts">
	import { type Snippet, tick } from 'svelte';
	import { fly } from 'svelte/transition';

	import { Assistance } from '$lib/api/sdk.gen';
	import type { ChatMessage, InterviewGuide, Question } from '$lib/api/types.gen';
	import { continuesReply } from '$lib/assistance/frames';
	import { renderAssistantMarkdown } from '$lib/assistance/markdown';
	import { textIn } from '$lib/guide/localized';
	import { localizeRenderedQuestion, normalizeGeneratedQuestions } from '$lib/guide/normalize';
	import type { GuideQuestion, GuideSection } from '$lib/stores/guideStore.svelte';

	interface Props {
		project_id: string;
		lang: string;
		guide: InterviewGuide | null;
		/** `ordinal` counts the suggested questions before this one, from 0. */
		questionMessage?: Snippet<[item: GuideQuestion, index: number, ordinal: number]>;
		/** `ordinal` counts the suggested sections before this one, from 0. */
		sectionMessage?: Snippet<
			[item: { section: GuideSection; questions: GuideQuestion[] }, index: number, ordinal: number]
		>;
		isMaximized?: boolean;
	}

	let {
		project_id,
		lang,
		guide,
		questionMessage,
		sectionMessage,
		isMaximized = $bindable(false)
	}: Props = $props();

	let isOpen = $state(false);
	let messages = $state<ChatMessage[]>([]);
	let input = $state('');
	let isStreaming = $state(false);
	let historyLoaded = $state(false);
	let messagesEl: HTMLDivElement | undefined = $state();
	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let confirmReset = $state(false);

	// Parsed state for typed messages (question/section). Keyed by message index.
	// Stored separately so edits are preserved even as new messages arrive.
	let parsedItems = $state<
		Record<number, GuideQuestion | { section: GuideSection; questions: GuideQuestion[] }>
	>({});

	$effect(() => {
		// Reset parsed items when the session is cleared
		if (messages.length === 0) {
			parsedItems = {};
			return;
		}
		// Parse any new typed messages that haven't been parsed yet
		messages.forEach((msg, i) => {
			if ((msg.type === 'question' || msg.type === 'section') && parsedItems[i] === undefined) {
				try {
					const data = JSON.parse(msg.content);
					// The assistant writes in the language being edited, so its text
					// becomes that language's; the others show as untranslated.
					// Suggested questions can't carry id-based condition targets (the
					// chat has no local section/question ids to resolve against), so
					// conditions are dropped until the user re-adds them in the editor.
					if (msg.type === 'question') {
						parsedItems[i] = localizeRenderedQuestion(data as Question, lang);
					} else {
						const { questions, ...sectionData } = data;
						parsedItems[i] = {
							section: {
								id: sectionData.id ?? crypto.randomUUID(),
								description: textIn(lang, sectionData.description),
								shuffle: sectionData.shuffle ?? false,
								ai_generated_questions: normalizeGeneratedQuestions(
									sectionData.ai_generated_questions
								),
								questions: []
							} as GuideSection,
							questions: ((questions ?? []) as Question[]).map((q) =>
								localizeRenderedQuestion(q, lang)
							)
						};
					}
				} catch {
					// Ignore unparseable content
				}
			}
		});
	});

	// For each message, how many messages of its type come before it, so a
	// suggested section can be numbered among the suggestions rather than by
	// its position in the chat.
	let ordinals = $derived.by(() => {
		const seen: Record<string, number> = {};
		return messages.map((msg) => {
			const type = msg.type ?? 'message';
			const n = seen[type] ?? 0;
			seen[type] = n + 1;
			return n;
		});
	});

	function scrollToBottom() {
		if (messagesEl) {
			messagesEl.scrollTop = messagesEl.scrollHeight;
		}
	}

	async function loadHistory() {
		if (historyLoaded) return;
		try {
			const { data, error } = await Assistance.getChat({
				path: { project_id, lang },
				credentials: 'include',
				parseAs: 'text'
			});
			if (!error && data) {
				messages = (data as string)
					.split('\n')
					.filter((l) => l.trim())
					.map((l) => JSON.parse(l) as ChatMessage);
			}
		} catch {
			// Ignore — no session yet or network error
		}
		historyLoaded = true;
	}

	async function toggle() {
		isOpen = !isOpen;
		if (isOpen) {
			await loadHistory();
			await tick();
			scrollToBottom();
		} else {
			confirmReset = false;
		}
	}

	async function send() {
		const prompt = input.trim();
		if (!prompt || isStreaming || !guide) return;

		input = '';
		resizeTextarea();
		isStreaming = true;

		// Optimistically show user message
		messages.push({ role: 'user', timestamp: new Date().toISOString(), content: prompt });

		// Add empty model placeholder for streaming into
		messages.push({ role: 'model', timestamp: new Date().toISOString(), content: '' });
		let modelIdx = messages.length - 1;

		await tick();
		scrollToBottom();

		try {
			const { data, error } = await Assistance.sendChat({
				path: { project_id, lang },
				body: { prompt: prompt, guide: guide },
				credentials: 'include',
				parseAs: 'stream'
			});

			if (error || !data) {
				messages[modelIdx] = {
					role: 'model',
					timestamp: new Date().toISOString(),
					content: 'Something went wrong. Please try again.'
				};
				return;
			}

			const reader = (data as ReadableStream<Uint8Array>).getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let firstChunk = true;
			let seenFirstModelChunk = false;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const msg = JSON.parse(line) as ChatMessage;
						if (firstChunk) {
							// Skip the user-echo the server sends as first chunk
							firstChunk = false;
							continue;
						}
						if (msg.role === 'model') {
							// The first frame fills the placeholder; after that, only a
							// growing reply replaces a message.
							if (!seenFirstModelChunk || continuesReply(messages[modelIdx], msg)) {
								messages[modelIdx] = msg;
							} else {
								messages.push(msg);
								modelIdx = messages.length - 1;
							}
							seenFirstModelChunk = true;
							await tick();
							scrollToBottom();
						}
					} catch {
						// Ignore unparseable lines
					}
				}
			}
		} catch {
			if (!messages[modelIdx]?.content) {
				messages[modelIdx] = {
					role: 'model',
					timestamp: new Date().toISOString(),
					content: 'Something went wrong. Please try again.'
				};
			}
		} finally {
			isStreaming = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	async function resetSession() {
		const { error } = await Assistance.resetSession({
			path: { project_id, lang: lang ?? '' }
		});
		if (error) {
			console.error('Failed to reset session', error);
			return;
		}
		messages = [];
		parsedItems = {};
		historyLoaded = false;
		confirmReset = false;
	}

	function resizeTextarea() {
		if (textareaEl) {
			textareaEl.style.height = 'auto';
			textareaEl.style.height = Math.min(textareaEl.scrollHeight, 100) + 'px';
		}
	}
</script>

<!-- FAB trigger button -->
<button
	data-tour="assistant-chat"
	onclick={toggle}
	aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
	class="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all hover:bg-dark active:scale-95"
>
	{#if isOpen}
		<i class="fa-solid fa-xmark text-xl"></i>
	{:else}
		<i class="fa-solid fa-comments text-xl"></i>
	{/if}
</button>

<!-- Chat window -->
{#if isOpen}
	<div
		class="fixed z-50 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10 transition-all duration-300 ease-in-out {isMaximized
			? 'right-4 bottom-4 h-[min(60rem,calc(100dvh-2rem))] w-[min(75rem,calc(100vw-2rem))] 2xl:w-[min(90rem,calc(100vw-2rem))]'
			: 'right-6 bottom-24 h-[min(40rem,calc(100dvh-8rem))] w-[min(30rem,calc(100vw-3rem))] 2xl:h-[min(48rem,calc(100dvh-8rem))] 2xl:w-xl'}"
		transition:fly={{ y: 16, duration: 200 }}
	>
		<!-- Header -->
		<div
			class="z-99 flex h-10 shrink-0 items-center gap-2 bg-primary px-4 py-3 text-white shadow-sm shadow-dark"
		>
			<span class="flex-1 text-sm font-semibold">Interview Guide Assistance</span>
			{#if confirmReset}
				<span class="text-xs opacity-90">Reset session?</span>
				<button
					onclick={resetSession}
					class="rounded px-1.5 py-0.5 text-xs font-medium hover:bg-white/20"
				>
					Yes
				</button>
				<button
					onclick={() => (confirmReset = false)}
					class="rounded px-1.5 py-0.5 text-xs font-medium hover:bg-white/20"
				>
					No
				</button>
			{:else}
				<button
					onclick={() => (confirmReset = true)}
					title="Reset session"
					class="ml-auto rounded p-1 opacity-70 transition-opacity hover:opacity-100"
				>
					<i class="fa-solid fa-rotate-right text-xs"></i>
				</button>
				<button
					onclick={() => (isMaximized = !isMaximized)}
					title={isMaximized ? 'Minimize' : 'Maximize'}
					class="rounded p-1 opacity-70 transition-opacity hover:opacity-100"
				>
					<i class="fa-solid {isMaximized ? 'fa-compress' : 'fa-expand'} text-xs"></i>
				</button>
				<button
					onclick={toggle}
					title="Close"
					class="rounded p-1 opacity-70 transition-opacity hover:opacity-100"
				>
					<i class="fa-solid fa-window-minimize text-xs"></i>
				</button>
			{/if}
		</div>

		<!-- Messages -->
		<!-- A named container, so suggested items can lay out compactly in the small view -->
		<div bind:this={messagesEl} class="@container/chat flex-1 overflow-y-auto px-4 py-4">
			{#if messages.length === 0}
				<p class="mt-8 text-center text-sm text-gray-400">
					Ask me anything about your interview project.
				</p>
			{:else}
				<div class="flex flex-col gap-3">
					{#each messages as msg, i (i)}
						{#if msg.type === 'question' && questionMessage && parsedItems[i]}
							<div class="w-full">
								{@render questionMessage(parsedItems[i] as GuideQuestion, i, ordinals[i])}
							</div>
						{:else if msg.type === 'section' && sectionMessage && parsedItems[i]}
							<div class="w-full">
								{@render sectionMessage(
									parsedItems[i] as { section: GuideSection; questions: GuideQuestion[] },
									i,
									ordinals[i]
								)}
							</div>
						{:else}
							<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
								<div
									class="max-w-[85%] rounded-2xl px-3 py-2 text-sm {msg.role === 'user'
										? 'rounded-tr-sm bg-primary whitespace-pre-wrap text-white'
										: 'rounded-tl-sm bg-gray-100 text-gray-800'}"
								>
									{#if msg.role === 'model' && msg.content === '' && isStreaming}
										<div class="flex items-center gap-1 py-0.5">
											<span class="typing-dot"></span>
											<span class="typing-dot" style="animation-delay: 0.15s"></span>
											<span class="typing-dot" style="animation-delay: 0.3s"></span>
										</div>
									{:else if msg.role === 'model'}
										<div
											class="prose prose-sm max-w-none text-gray-800 prose-gray *:first:mt-0 *:last:mb-0 prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1.5 prose-a:text-primary prose-pre:my-2 prose-ol:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 [&_li]:marker:text-gray-600"
										>
											<!-- Raw HTML is escaped and links are scheme-checked in renderAssistantMarkdown -->
											<!-- eslint-disable-next-line svelte/no-at-html-tags -->
											{@html renderAssistantMarkdown(msg.content)}
										</div>
									{:else}
										{msg.content}
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Input -->
		<div class="shrink-0 border-t border-gray-100 px-3 py-3">
			<div class="flex items-end gap-2">
				<textarea
					bind:this={textareaEl}
					bind:value={input}
					onkeydown={onKeydown}
					oninput={resizeTextarea}
					placeholder="Ask a question…"
					rows="1"
					disabled={isStreaming}
					class="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
					style="max-height: 100px; overflow-y: auto;"></textarea>
				<button
					onclick={send}
					disabled={isStreaming || !input.trim()}
					aria-label="Send"
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-opacity disabled:opacity-40"
				>
					<i class="fa-solid fa-paper-plane text-sm"></i>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.typing-dot {
		width: 6px;
		height: 6px;
		background: #9ca3af;
		border-radius: 50%;
		display: inline-block;
		animation: typing 1.5s ease-in-out infinite;
	}

	@keyframes typing {
		0%,
		40%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		20% {
			transform: translateY(-5px);
			opacity: 1;
		}
	}
</style>
