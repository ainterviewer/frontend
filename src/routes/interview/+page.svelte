<script lang="ts">
	import type { InterviewType, Welcome } from '$lib/api';
	import { Projects, type Consent } from '$lib/api';
	import InterviewChat from '$lib/components/interview/InterviewChat.svelte';
	import { onMount } from 'svelte';
	import { ChatClient, createInterview, getInterviewIdFromCookie } from './chat.svelte';

	interface PageData {
		project_id: string;
		lang: string;
		interviewType?: InterviewType;
		experimentID?: string;
		image_upload?: boolean;
		help_title?: string;
		help_text?: string;
		exit_title?: string;
		exit_text?: string;
		exit_button?: string;
	}

	let { data }: { data: PageData } = $props();

	let projectId = $derived(data.project_id);
	let lang = $derived(data.lang);
	let imageUpload = $derived(data.image_upload);

	// Help/Exit data
	let helpTitle = $derived(data.help_title || 'Help');
	let helpText = $derived(data.help_text || 'Help text goes here.');
	let exitTitle = $derived(data.exit_title || 'Exit Interview');
	let exitText = $derived(data.exit_text || 'Are you sure you want to exit?');
	let exitButtonText = $derived(data.exit_button || 'End Interview');

	// Chat client - initialized after consent/interview creation
	let chat = $state<ChatClient | null>(null);

	// Welcome flow state
	let showWelcome = $state(false);
	let welcomeData = $state<Welcome | null>(null);

	// Consent flow state
	let showConsent = $state(false);
	let consentData = $state<Consent | null>(null);
	let isInitializing = $state(true);
	let consentAccepting = $state(false);

	onMount(() => {
		const existingInterviewId = getInterviewIdFromCookie();

		if (existingInterviewId) {
			initializeChat(existingInterviewId);
		} else {
			loadConsent();
		}

		return () => chat?.disconnect();
	});

	function initializeChat(interviewId: string) {
		chat = new ChatClient(projectId, 'respondent', lang);
		chat.initialize(interviewId);
		isInitializing = false;
	}

	async function loadWelcome() {
		try {
			const { data: welcome } = await Projects.getWelcome({
				path: {
					project_id: projectId,
					language: lang
				}
			});

			if (welcome && (welcome.title || welcome.text)) {
				welcomeData = welcome;
				showWelcome = true;
				isInitializing = false;
			} else {
				await startInterview();
			}
		} catch (e) {
			console.error('Error loading welcome', e);
			await startInterview();
		}
	}

	async function loadConsent() {
		try {
			const { data: consent } = await Projects.getConsent({
				path: {
					project_id: projectId,
					language: lang
				}
			});

			if (consent && consent.title && consent.text) {
				consentData = consent;
				showConsent = true;
				isInitializing = false;
			} else {
				await loadWelcome();
			}
		} catch (e) {
			console.error('Error loading consent', e);
			await loadWelcome();
		}
	}

	async function startInterview() {
		const newInterviewId = await createInterview(
			projectId,
			lang,
			data.interviewType,
			data.experimentID
		);

		if (newInterviewId) {
			initializeChat(newInterviewId);
		} else {
			console.error('Failed to create interview');
			isInitializing = false;
		}
	}

	async function proceedFromWelcome() {
		showWelcome = false;
		isInitializing = true;
		await startInterview();
	}

	async function acceptConsent() {
		consentAccepting = true;

		try {
			const { data: welcome } = await Projects.getWelcome({
				path: {
					project_id: projectId,
					language: lang
				}
			});

			if (welcome && (welcome.title || welcome.text)) {
				welcomeData = welcome;
				showWelcome = true;
				showConsent = false;
			} else {
				await startInterview();
				showConsent = false;
			}
		} catch (e) {
			console.error('Error loading welcome', e);
			await startInterview();
			showConsent = false;
		}

		consentAccepting = false;
	}

	function declineConsent() {
		window.location.href = '/';
	}
</script>

<div class="flex h-dvh w-full flex-col bg-white pb-[env(safe-area-inset-bottom)]">
	<!-- Header -->
	<h1
		class="mx-auto mt-6 w-fit bg-[url('/svgs/underline-main.svg')] bg-bottom bg-center bg-no-repeat pb-12 text-center text-3xl font-bold text-dark"
	>
		AInterviewer
	</h1>

	{#if chat}
		<InterviewChat
			{chat}
			{lang}
			{imageUpload}
			{helpTitle}
			{helpText}
			{exitTitle}
			{exitText}
			{exitButtonText}
		/>
	{/if}
</div>

<!-- Modal Container -->
{#if (showWelcome && welcomeData) || (showConsent && consentData)}
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby={showWelcome ? 'welcome-title' : 'consent-title'}
	>
		{#if showWelcome && welcomeData}
			<div class="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
				<div class="max-h-[calc(100vh-120px)] overflow-y-auto px-6 py-8 sm:p-10">
					<h2 id="welcome-title" class="text-2xl font-bold tracking-tight text-gray-900">
						{welcomeData.title}
					</h2>

					{#if welcomeData.video_file_name}
						<div class="mt-4 overflow-hidden rounded-lg bg-black">
							<video controls class="w-full">
								<source src={`/assets/videos/${welcomeData.video_file_name}`} type="video/mp4" />
								Your browser does not support the video tag.
							</video>
						</div>
					{/if}

					<div class="mt-4 leading-relaxed whitespace-pre-wrap text-gray-700">
						{welcomeData.text}
					</div>

					{#if welcomeData.email}
						<hr class="my-6 border-gray-200" />
						<div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
							<p class="mb-2">
								If you wish to withdraw your consent or change your answers, please contact
								<a
									href="mailto:{welcomeData.email}"
									class="font-medium text-primary hover:underline"
								>
									{welcomeData.email}
								</a>
								with a reference to the following code:
							</p>
							<div
								class="my-2 flex w-fit items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
							>
								<code class="font-mono text-sm text-gray-700">&lt;interview-id&gt;</code>
								<i class="fa-solid fa-fingerprint text-gray-400"></i>
							</div>
							<p class="text-xs text-gray-500">
								It is your own responsibility to store this code securely before starting the
								interview. It is the only way for us to identify and modify or delete your data.
							</p>
						</div>
					{/if}

					<div class="mt-8">
						<button
							onclick={proceedFromWelcome}
							class="rounded-md bg-[#007bff] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0056b3] focus:ring-2 focus:ring-[#007bff] focus:ring-offset-2 focus:outline-none"
						>
							Start Interview
						</button>
					</div>
				</div>
			</div>
		{:else if showConsent && consentData}
			<div class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
				<div class="max-h-[calc(100vh-120px)] overflow-y-auto px-6 py-8 sm:p-10">
					<h2 id="consent-title" class="text-2xl font-bold tracking-tight text-gray-900">
						{consentData.title}
					</h2>
					<div class="mt-4 leading-relaxed whitespace-pre-wrap text-gray-700">
						{consentData.text}
					</div>
					<div class="mt-8 flex gap-3">
						<button
							onclick={acceptConsent}
							disabled={consentAccepting}
							class="rounded-md bg-[#007bff] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0056b3] focus:ring-2 focus:ring-[#007bff] focus:ring-offset-2 focus:outline-none disabled:opacity-50"
						>
							{#if consentAccepting}
								<i class="fa-solid fa-spinner fa-spin mr-2"></i>
							{/if}
							Accept
						</button>
						<button
							onclick={declineConsent}
							disabled={consentAccepting}
							class="rounded-md bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
						>
							Decline
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<!-- Loading State -->
{#if isInitializing && !showConsent && !showWelcome}
	<div class="fixed inset-0 z-[200] flex items-center justify-center bg-white">
		<div class="flex flex-col items-center gap-4">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#007bff]"
			></div>
			<p class="text-sm text-gray-500">Loading...</p>
		</div>
	</div>
{/if}
