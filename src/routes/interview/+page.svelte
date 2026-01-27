<script lang="ts">
	import type { InterviewType, Welcome } from '$lib/api';
	import { Projects, type Consent } from '$lib/api';
	import InterviewChat from '$lib/components/interview/InterviewChat.svelte';
	import { WelcomeModal, ConsentModal } from '$lib/components/modals';
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
	let interviewType = $derived(data.interviewType);
	let imageUpload = $derived(data.image_upload);

	// Help/Exit data
	let helpTitle = $derived(data.help_title || 'Help');
	let helpText = $derived(
		data.help_text ||
			'Type your answers and send them. You can skip or rate questions. You may pause and return later, or exit anytime.'
	);
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
			{interviewType}
			{imageUpload}
			{helpTitle}
			{helpText}
			{exitTitle}
			{exitText}
			{exitButtonText}
		/>
	{/if}
</div>

<!-- Welcome Modal -->
<WelcomeModal
	show={showWelcome && !!welcomeData}
	title={welcomeData?.title ?? ''}
	text={welcomeData?.text ?? ''}
	videoUrl={welcomeData?.video_file_name ? `/assets/videos/${welcomeData.video_file_name}` : null}
	email={welcomeData?.email ?? null}
	onProceed={proceedFromWelcome}
	animate={false}
/>

<!-- Consent Modal -->
<ConsentModal
	show={showConsent && !!consentData}
	title={consentData?.title ?? ''}
	text={consentData?.text ?? ''}
	onAccept={acceptConsent}
	onDecline={declineConsent}
	accepting={consentAccepting}
	animate={false}
/>

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
