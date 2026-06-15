<script lang="ts">
	import { Auth, type InterviewConfig, type InterviewType } from '$lib/api';
	import InterviewMessage from '$lib/components/interview/InterviewMessage.svelte';
	import { tick } from 'svelte';
	import { clearInterviewSession, type ChatClient } from '../../../routes/interview/chat.svelte';
	import GradientProgressBar from './GradientProgressBar.svelte';
	import Modal from './Modal.svelte';
	import SpeechInput from './SpeechInput.svelte';
	import { TtsPlayer } from './tts';
	import TypingIndicator from './TypingIndicator.svelte';

	interface Props {
		chat: ChatClient;
		lang: string;
		interviewType?: InterviewType;
		interviewConfig: InterviewConfig;
		helpTitle: string;
		helpText: string;
		exitTitle: string;
		exitText: string;
		exitButtonText: string;
	}

	let {
		chat,
		lang,
		interviewType,
		interviewConfig,
		helpTitle,
		helpText,
		exitTitle,
		exitText,
		exitButtonText
	}: Props = $props();

	let messageInput = $state('');
	let messagesContainer: HTMLDivElement | undefined = $state();
	let textarea: HTMLTextAreaElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();

	let showHelp = $state(false);
	let showExit = $state(false);
	let isRecording = $state(false);

	let imageUpload = $state(false);

	let surveyActive = $derived.by(() => {
		for (let i = chat.messages.length - 1; i >= 0; i--) {
			const m = chat.messages[i];
			if (m.survey_item) return true;
			if (m.type === 'received' && m.can_answer === true) return false;
		}
		return false;
	});

	// Auto-scroll logic
	$effect(() => {
		const _ = [chat.messages.length, chat.showTypingIndicator];
		scrollToBottom();
	});

	async function scrollToBottom() {
		await tick();
		if (!messagesContainer) return;
		if (surveyActive) {
			let surveyIdx = -1;
			for (let i = chat.messages.length - 1; i >= 0; i--) {
				if (chat.messages[i].survey_item) {
					surveyIdx = i;
					break;
				}
			}
			let questionIdx = -1;
			for (let i = surveyIdx - 1; i >= 0; i--) {
				if (chat.messages[i].type === 'received') {
					questionIdx = i;
					break;
				}
			}
			const target = messagesContainer.children[questionIdx] ?? messagesContainer.lastElementChild;
			target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			return;
		}
		messagesContainer.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		target.style.height = 'auto';
		target.style.height = target.scrollHeight + 'px';
		if (target.scrollHeight > 150) {
			target.style.overflowY = 'scroll';
		} else {
			target.style.overflowY = 'hidden';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			handleSubmit(e);
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!messageInput.trim()) return;
		chat.sendMessage(messageInput.trim());
		messageInput = '';
		if (textarea) {
			textarea.style.height = 'auto';
		}
	}

	function triggerCamera() {
		fileInput?.click();
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			chat.sendImage(target.files[0]);
			target.value = '';
		}
	}

	async function exitInterview() {
		const { error } = await Auth.exit();
		if (error) {
			console.error('Failed to exit interview:', error);
			return;
		}

		clearInterviewSession(chat.project_id);

		if (interviewType === 'manual_test' && window.opener) {
			window.close();
		} else {
			window.location.href = '/';
		}
	}

	// Auto-play: when enabled, each new interviewer message is read aloud,
	// queued one at a time in arrival order.
	let autoPlayAudio = $state(false);
	const tts = new TtsPlayer();
	// Messages up to this index have already been considered for speech.
	let spokenUpTo = 0;

	function speakableMessage(msg: (typeof chat.messages)[number] | undefined) {
		return (
			msg &&
			msg.type === 'received' &&
			msg.message_id != null &&
			msg.text &&
			!msg.text.startsWith('<|')
		);
	}

	function toggleAutoPlay() {
		autoPlayAudio = !autoPlayAudio;
		if (!autoPlayAudio) {
			tts.stop();
			return;
		}
		// Only speak messages arriving from here on, plus the current question.
		// Reading it right away also runs inside the click gesture, which
		// unlocks audio playback under browser autoplay policies.
		spokenUpTo = chat.messages.length;
		for (let i = chat.messages.length - 1; i >= 0; i--) {
			const msg = chat.messages[i];
			if (speakableMessage(msg)) {
				tts.enqueue(Number(msg.message_id));
				return;
			}
		}
	}

	$effect(() => {
		const count = chat.messages.length;
		if (!autoPlayAudio) return;
		for (let i = spokenUpTo; i < count; i++) {
			const msg = chat.messages[i];
			if (speakableMessage(msg)) tts.enqueue(Number(msg.message_id));
		}
		spokenUpTo = count;
	});

	// Stop playback when the chat unmounts.
	$effect(() => () => tts.stop());

	function handleTranscript(transcript: string, audioFilename: string | null) {
		isRecording = false;
		const text = transcript.trim();
		if (text) {
			chat.sendMessage(text, audioFilename);
		} else {
			// The recording is persisted server-side, but no transcript came back.
			chat.messages.push({
				type: 'system',
				text: 'Your recording could not be transcribed. Please try again or type your answer.'
			});
		}
	}
</script>

<!-- Chat Area -->
<div class="mb-1 flex flex-1 grow flex-col items-center overflow-y-auto lg:mb-4">
	<div
		id="messages"
		bind:this={messagesContainer}
		class="w-full flex-1 overflow-y-auto px-2.5 sm:w-[90%] sm:max-w-[700px] sm:min-w-[500px] sm:px-0"
	>
		{#each chat.messages as msg, i (i)}
			<div
				class={msg.type === 'system' ? 'mb-4 text-center text-sm text-gray-500 select-none' : ''}
			>
				{#if msg.type === 'system'}
					{msg.text}
				{:else}
					<InterviewMessage
						message={msg}
						{lang}
						isLast={i === chat.messages.length - 1}
						onFeedback={(f: 'positive' | 'negative' | null, id: string | number) =>
							chat.sendFeedback(f, id)}
						onSkip={() => chat.sendSkip()}
						onSurveyAnswer={(ans: unknown, id: string | number) => chat.sendSurveyResponse(ans, id)}
					/>
				{/if}
			</div>
		{/each}

		{#if chat.showTypingIndicator}
			<TypingIndicator />
		{/if}
	</div>
</div>

<!-- Reconnection Indicator -->
{#if !chat.reconnectFailed && chat.isReconnecting && chat.messages.length > 0}
	<div
		class="fixed top-2 right-1/2 z-50 flex translate-x-[50%] items-center rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md transition-all lg:right-4 lg:translate-x-0"
	>
		<div
			class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
		></div>
		Reconnecting...
	</div>
{/if}

<!-- Reconnection Failure -->
{#if chat.reconnectFailed}
	<div
		class="fixed top-2 right-1/2 z-50 flex translate-x-[50%] items-center gap-3 rounded-lg bg-red-600/95 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md lg:right-4 lg:translate-x-0"
	>
		<span>Connection lost. Unable to reconnect.</span>
		<button
			type="button"
			class="rounded bg-white/15 px-2 py-1 text-xs font-semibold transition-colors hover:bg-white/25"
			onclick={() => chat.manualReconnect()}
		>
			Retry
		</button>
	</div>
{/if}

<!-- Input Area -->
<div class="flex w-full flex-col items-center pb-2">
	<form
		onsubmit={handleSubmit}
		class="flex w-full flex-row items-center justify-center px-4 sm:px-0"
	>
		<!-- Controls Left -->
		<div class="mr-2 flex flex-col gap-1.75">
			{#if imageUpload}
				<button
					type="button"
					class="flex h-7.5 w-7.5 items-center justify-center bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-100 disabled:opacity-50"
					onclick={triggerCamera}
					disabled={!chat.inputEnabled}
					title="Upload Image"
				>
					<i class="fa-regular fa-image text-lg text-gray-600"></i>
				</button>
				<input
					bind:this={fileInput}
					type="file"
					accept="image/*"
					capture={imageUpload === 'camera' ? 'environment' : undefined}
					class="hidden"
					onchange={handleFileSelect}
				/>
			{/if}
			<button
				type="button"
				class="flex size-8 items-center justify-center rounded-md bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-200"
				class:hidden={!interviewConfig.with_audio}
				onclick={toggleAutoPlay}
				title={autoPlayAudio ? 'Stop reading questions aloud' : 'Read questions aloud'}
			>
				{#if autoPlayAudio}
					<i class="fa-solid fa-volume-high text-lg text-primary"></i>
				{:else}
					<i class="fa-solid fa-volume-xmark text-lg text-gray-600"></i>
				{/if}
			</button>
			<button
				type="button"
				class="flex size-8 items-center justify-center rounded-md bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-200"
				onclick={() => (showHelp = true)}
				title="Show help"
			>
				<i class="fa-regular fa-circle-question text-lg text-gray-600"></i>
			</button>
			<button
				type="button"
				class="flex size-8 items-center justify-center rounded-md bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-200"
				onclick={() => (showExit = true)}
				title="End interview"
			>
				<i class="fa-solid fa-door-open text-lg text-gray-600"></i>
			</button>
		</div>

		<!-- Textarea / speech indicator while recording -->
		{#if isRecording}
			<SpeechInput onTranscript={handleTranscript} onCancel={() => (isRecording = false)} />
		{:else}
			<textarea
				bind:this={textarea}
				bind:value={messageInput}
				disabled={!chat.inputEnabled}
				rows="1"
				placeholder="Message"
				{lang}
				class="
					w-full resize-none rounded border border-gray-300 p-2.5 shadow-sm transition-all
					focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none
					disabled:text-[#666666]
					sm:max-h-32 sm:w-[40%] sm:max-w-125 sm:min-w-85
				"
				class:min-h-25={!surveyActive}
				class:min-h-10={surveyActive}
				oninput={handleInput}
				onkeydown={handleKeydown}
			></textarea>
		{/if}

		<!-- Send Button -->
		<div class="ml-1.5 flex flex-col">
			<button
				type="submit"
				disabled={!chat.inputEnabled || !messageInput.trim()}
				id="send-message"
				class="
					mt-3.75 cursor-pointer rounded bg-primary px-3 py-1.5 text-sm text-white transition-colors
					hover:bg-dark
					disabled:cursor-not-allowed disabled:bg-[#cccccc] disabled:text-[#666666]
				"
				title="Send message (Ctrl+Enter)"
			>
				Send
			</button>
			<div class="mt-1 hidden text-center text-xs text-gray-400 sm:block">
				<span class="font-sans">ctrl</span>+<span class="font-bold">↵</span>
			</div>
			<div class="flex" class:hidden={!interviewConfig.with_audio}>
				<button
					type="button"
					class="
          m-auto flex size-8 items-center justify-center rounded-md bg-center
          bg-no-repeat p-0 text-gray-600 transition-colors hover:bg-gray-200
					disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white
          "
					onclick={() => (isRecording = true)}
					disabled={!chat.inputEnabled || isRecording}
					title="Record audio"
				>
					<i class="fas fa-microphone-lines text-lg"></i>
				</button>
			</div>
		</div>
	</form>

	<div class="mt-2 w-full max-w-100 px-4 sm:px-0">
		<GradientProgressBar progress={chat.progress} />
	</div>
</div>

<Modal show={showHelp} title={helpTitle} onClose={() => (showHelp = false)}>
	<div class="prose prose-sm max-w-none text-gray-600">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html helpText}
	</div>
</Modal>

<Modal show={showExit} title={exitTitle} onClose={() => (showExit = false)}>
	<div class="prose prose-sm max-w-none text-gray-600">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html exitText}
	</div>
	<div class="mt-6 flex justify-end">
		<button
			class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
			onclick={exitInterview}
		>
			{exitButtonText}
		</button>
	</div>
</Modal>
