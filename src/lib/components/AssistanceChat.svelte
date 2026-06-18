<script lang="ts">
	import { Assistance } from '$lib/api/sdk.gen';
	import type { ChatMessage, InterviewGuideOutput, QuestionOutput } from '$lib/api/types.gen';
	import type { GuideQuestion, GuideSection } from '$lib/stores/guideStore.svelte';
	import { tick, type Snippet } from 'svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		project_id: string;
		lang: string;
		guide: InterviewGuideOutput | null;
		questionMessage?: Snippet<[item: GuideQuestion, index: number]>;
		sectionMessage?: Snippet<
			[item: { section: GuideSection; questions: GuideQuestion[] }, index: number]
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
					if (msg.type === 'question') {
						parsedItems[i] = { ...data, id: data.id ?? crypto.randomUUID() } as GuideQuestion;
					} else {
						const { questions, ...sectionData } = data;
						parsedItems[i] = {
							section: {
								...sectionData,
								id: sectionData.id ?? crypto.randomUUID(),
								questions: []
							} as GuideSection,
							questions: ((questions ?? []) as (QuestionOutput & { id?: string })[]).map((q) => ({
								...q,
								id: q.id ?? crypto.randomUUID()
							}))
						};
					}
				} catch {
					// Ignore unparseable content
				}
			}
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
			let currentMsgType: string | undefined;

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
							if (seenFirstModelChunk && msg.type !== currentMsgType) {
								// New distinct message — append a new slot rather than overwriting
								messages.push(msg);
								modelIdx = messages.length - 1;
							} else {
								// Same message, accumulating — replace in place
								messages[modelIdx] = msg;
							}
							seenFirstModelChunk = true;
							currentMsgType = msg.type;
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
			? 'right-4 bottom-4 h-200 w-300'
			: 'right-6 bottom-24 h-125 w-100'}"
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
		<div bind:this={messagesEl} class="flex-1 overflow-y-auto px-4 py-4">
			{#if messages.length === 0}
				<p class="mt-8 text-center text-sm text-gray-400">
					Ask me anything about your interview project.
				</p>
			{:else}
				<div class="flex flex-col gap-3">
					{#each messages as msg, i (i)}
						{#if msg.type === 'question' && questionMessage && parsedItems[i]}
							<div class="w-full">
								{@render questionMessage(parsedItems[i] as GuideQuestion, i)}
							</div>
						{:else if msg.type === 'section' && sectionMessage && parsedItems[i]}
							<div class="w-full">
								{@render sectionMessage(
									parsedItems[i] as { section: GuideSection; questions: GuideQuestion[] },
									i
								)}
							</div>
						{:else}
							<div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
								<div
									class="max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap {msg.role ===
									'user'
										? 'rounded-tr-sm bg-primary text-white'
										: 'rounded-tl-sm bg-gray-100 text-gray-800'}"
								>
									{#if msg.role === 'model' && msg.content === '' && isStreaming}
										<div class="flex items-center gap-1 py-0.5">
											<span class="typing-dot"></span>
											<span class="typing-dot" style="animation-delay: 0.15s"></span>
											<span class="typing-dot" style="animation-delay: 0.3s"></span>
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
					style="max-height: 100px; overflow-y: auto;"
				></textarea>
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
