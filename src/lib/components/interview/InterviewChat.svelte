<script lang="ts">
	import { Auth, type InterviewType } from '$lib/api';
	import InterviewMessage from '$lib/components/interview/InterviewMessage.svelte';
	import { tick } from 'svelte';
	import type { ChatClient } from '../../../routes/interview/chat.svelte';
	import AudioRecordingOverlay from './AudioRecordingOverlay.svelte';
	import GradientProgressBar from './GradientProgressBar.svelte';
	import Modal from './Modal.svelte';
	import TypingIndicator from './TypingIndicator.svelte';

	interface Props {
		chat: ChatClient;
		lang: string;
		interviewType: InterviewType;
		imageUpload?: any;
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
		imageUpload,
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
	let showRecordingOverlay = $state(false);

	// Auto-scroll logic
	$effect(() => {
		const _ = [chat.messages.length, chat.showTypingIndicator];
		scrollToBottom();
	});

	async function scrollToBottom() {
		await tick();
		if (messagesContainer && messagesContainer.lastElementChild) {
			messagesContainer.lastElementChild.scrollIntoView({ behavior: 'smooth' });
		}
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

	function exitInterview() {
		Auth.exit().then(({ response }) => {
			if (response.ok) {
				if (interviewType === 'manual_test' && window.opener) {
					window.close();
				} else {
					window.location.href = '/';
				}
			}
		});
	}

	function handleAudioSend(blob: Blob, duration: number) {
		chat.sendAudio('', blob, duration);
	}
</script>

<!-- Chat Area -->
<div class="mb-8 flex flex-1 grow flex-col items-center overflow-y-auto">
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
						onFeedback={(f: any, id: any) => chat.sendFeedback(f, id)}
						onSkip={() => chat.sendSkip()}
						onSurveyAnswer={(ans: any, id: any) => chat.sendSurveyResponse(ans, id)}
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
{#if chat.isConnecting && !chat.isConnected && chat.messages.length > 0}
	<div
		class="fixed top-20 right-4 z-50 flex items-center rounded-full bg-gray-900/90 px-4 py-2 text-sm font-medium text-white shadow-xl backdrop-blur-md transition-all"
	>
		<div
			class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
		></div>
		Reconnecting...
	</div>
{/if}

<!-- Input Area -->
<div class="flex w-full flex-col items-center pb-2">
	<form
		onsubmit={handleSubmit}
		class="flex w-full flex-row items-center justify-center px-4 sm:px-0"
	>
		<!-- Controls Left -->
		<div class="mr-2 flex flex-col gap-[7px]">
			{#if imageUpload}
				<button
					type="button"
					class="flex h-[30px] w-[30px] items-center justify-center bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-100 disabled:opacity-50"
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

		<!-- Textarea -->
		<textarea
			bind:this={textarea}
			bind:value={messageInput}
			disabled={!chat.inputEnabled}
			rows="1"
			placeholder="Message"
			{lang}
			class="
				min-h-25 w-full resize-none rounded border border-gray-300 p-2.5 shadow-sm transition-all
				focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none
				disabled:text-[#666666]
				sm:max-h-32 sm:w-[40%] sm:max-w-125 sm:min-w-85
			"
			oninput={handleInput}
			onkeydown={handleKeydown}
		></textarea>

		<!-- Send Button -->
		<div class="ml-1.5 flex flex-col">
			<button
				type="submit"
				disabled={!chat.inputEnabled || !messageInput.trim()}
				id="send-message"
				class="
					mt-[15px] cursor-pointer rounded bg-primary px-3 py-1.5 text-sm text-white transition-colors
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
			<div class="flex hidden">
				<button
					type="button"
					class="m-auto flex size-8 items-center justify-center rounded-md bg-center bg-no-repeat p-0 transition-colors hover:bg-gray-200"
					onclick={() => (showRecordingOverlay = true)}
					disabled={!chat.inputEnabled}
					title="Record audio"
				>
					<i class="fas fa-microphone-lines text-lg text-gray-600"></i>
				</button>
			</div>
		</div>
	</form>

	<div class="mt-2 w-full max-w-[25rem] px-4 sm:px-0">
		<GradientProgressBar progress={chat.progress} />
	</div>
</div>

<Modal show={showHelp} title={helpTitle} onClose={() => (showHelp = false)}>
	<div class="prose prose-sm max-w-none text-gray-600">
		{@html helpText}
	</div>
</Modal>

<Modal show={showExit} title={exitTitle} onClose={() => (showExit = false)}>
	<div class="prose prose-sm max-w-none text-gray-600">
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

<AudioRecordingOverlay bind:show={showRecordingOverlay} onSend={handleAudioSend} />
