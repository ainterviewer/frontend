<script lang="ts">
	import type { InterviewConfig, InterviewType, Welcome } from '$lib/api';
	import { Projects, type Consent } from '$lib/api';
	import InterviewChat from '$lib/components/interview/InterviewChat.svelte';
	import { ConsentModal, LanguagePickerModal, WelcomeModal } from '$lib/components/modals';
	import { onMount } from 'svelte';
	import {
		ChatClient,
		createInterview,
		getInterviewIdFromCookie,
		getProjectIdFromCookie,
		parseInterviewIdFromToken
	} from './chat.svelte';

	interface PageData {
		project_id: string;
		lang: string;
		interviewType?: InterviewType;
		experimentID?: string;
		interviewConfig: InterviewConfig;
		isProjectOwnerDemoUser: boolean;
		availableLanguages: Array<{ name: string; code: string }>;
		help_title?: string;
		help_text?: string;
		exit_title?: string;
		exit_text?: string;
		exit_button?: string;
		authError?: boolean;
		externalParams?: Record<string, string> | null;
		referer?: string | null;
	}

	let { data }: { data: PageData } = $props();

	let projectId = $derived(data.project_id);
	let lang = $derived(data.lang);
	let interviewType = $derived(data.interviewType);
	const interviewConfig = $derived(data.interviewConfig);
	const isDemoBlocked = $derived(data.isProjectOwnerDemoUser && interviewType === 'distributed');
	const isAuthBlocked = $derived(data.authError === true);

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

	// Interview ID - created after consent, before welcome
	let interviewId = $state<string | null>(null);

	// Welcome flow state
	let showWelcome = $state(false);
	let welcomeData = $state<Welcome | null>(null);

	// Language picker state
	let showLanguagePicker = $state(false);
	const availableLanguages = $derived(data.availableLanguages);

	// Consent flow state
	let showConsent = $state(false);
	let consentData = $state<Consent | null>(null);
	let isInitializing = $state(true);
	let consentAccepting = $state(false);
	let validationErrors = $state<Array<{ loc: string; msg: string }> | null>(null);

	onMount(() => {
		if (isDemoBlocked || isAuthBlocked) {
			isInitializing = false;
			return;
		}

		const existingProjectId = getProjectIdFromCookie();
		const existingInterviewId = getInterviewIdFromCookie();

		if (
			existingInterviewId &&
			existingProjectId === projectId &&
			!(interviewType === 'manual_test')
		) {
			initializeChat(existingInterviewId);
		} else if (availableLanguages.length > 1) {
			showLanguagePicker = true;
			isInitializing = false;
		} else {
			loadConsent();
		}

		return () => chat?.disconnect();
	});

	async function createInterviewAndGetId(): Promise<string | null> {
		const result = await createInterview(
			projectId,
			lang,
			data.interviewType,
			data.experimentID,
			data.externalParams,
			data.referer,
			data.externalParams?.pid ?? null
		);

		if (result.ok) {
			const parsedId = parseInterviewIdFromToken(result.token);
			if (parsedId) {
				interviewId = parsedId;
				return parsedId;
			} else {
				console.error('Failed to parse interview ID from token');
				return null;
			}
		} else {
			if (result.validationErrors) {
				validationErrors = result.validationErrors;
			}
			console.error('Failed to create interview');
			return null;
		}
	}

	function initializeChat(interviewId: string) {
		chat = new ChatClient(projectId, 'respondent', lang);
		chat.initialize(interviewId);
		isInitializing = false;
	}

	async function loadWelcome() {
		const { data: welcome, error: welcomeError } = await Projects.getWelcome({
			path: {
				project_id: projectId,
				language: lang
			}
		});

		if (welcomeError) {
			console.error('Error loading welcome', welcomeError);
			startInterview();
			return;
		}

		if (welcome && (welcome.title || welcome.text)) {
			welcomeData = welcome;
			showWelcome = true;
			isInitializing = false;
		} else {
			startInterview();
		}
	}

	async function loadConsent() {
		const { data: consent, error: consentError } = await Projects.getConsent({
			path: {
				project_id: projectId,
				language: lang
			}
		});

		if (consentError) {
			console.error('Error loading consent', consentError);
			// Error loading consent - create interview and proceed to welcome
			const newInterviewId = await createInterviewAndGetId();
			if (newInterviewId) {
				await loadWelcome();
			} else {
				isInitializing = false;
			}
			return;
		}

		if (consent && consent.title && consent.text) {
			consentData = consent;
			showConsent = true;
			isInitializing = false;
		} else {
			// No consent configured - create interview and proceed to welcome
			const newInterviewId = await createInterviewAndGetId();
			if (newInterviewId) {
				await loadWelcome();
			} else {
				isInitializing = false;
			}
		}
	}

	function startInterview() {
		if (interviewId) {
			initializeChat(interviewId);
		} else {
			console.error('No interview ID available');
			isInitializing = false;
		}
	}

	function proceedFromWelcome() {
		showWelcome = false;
		isInitializing = true;
		startInterview();
	}

	async function acceptConsent() {
		consentAccepting = true;

		// Create interview after consent is accepted
		const newInterviewId = await createInterviewAndGetId();
		if (!newInterviewId) {
			consentAccepting = false;
			isInitializing = false;
			return;
		}

		const { data: welcome, error: welcomeError } = await Projects.getWelcome({
			path: {
				project_id: projectId,
				language: lang
			}
		});

		if (welcomeError) {
			console.error('Error loading welcome', welcomeError);
			startInterview();
			showConsent = false;
		} else if (welcome && (welcome.title || welcome.text)) {
			welcomeData = welcome;
			showWelcome = true;
			showConsent = false;
		} else {
			startInterview();
			showConsent = false;
		}

		consentAccepting = false;
	}

	function selectLanguage(code: string) {
		lang = code;
		showLanguagePicker = false;
		isInitializing = true;
		loadConsent();
	}

	function declineConsent() {
		window.location.href = '/';
	}
</script>

<svelte:head>
	<base target="_blank" />
</svelte:head>

<div class="flex h-dvh w-full flex-col bg-white pb-[env(safe-area-inset-bottom)]">
	<!-- Header -->
	<h1
		class="mx-auto mt-2 w-fit bg-[url('/svgs/underline-main.svg')] bg-size-[100%_25px] bg-bottom bg-no-repeat pb-5 text-center text-3xl font-bold text-dark lg:mt-6 lg:pb-8"
	>
		AInterviewer
	</h1>

	{#if isDemoBlocked}
		<div class="flex flex-1 items-center justify-center px-6">
			<p class="text-center text-gray-600">This interview is not available for demo projects.</p>
		</div>
	{:else if isAuthBlocked}
		<div class="flex flex-1 items-center justify-center px-6">
			<p class="text-center text-gray-600">You must be logged in to access this interview.</p>
		</div>
	{:else if validationErrors}
		<div class="flex flex-1 items-center justify-center px-6">
			<div class="max-w-md text-center">
				<div
					class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100"
				>
					<i class="fa-solid fa-triangle-exclamation text-xl text-red-600"></i>
				</div>
				<h2 class="mb-2 text-lg font-semibold text-gray-900">Missing required parameters</h2>
				<p class="mb-4 text-sm text-gray-600">
					This interview link is missing required URL parameters. Please make sure that you used the
					exact link provided to you and try again. If the error persists contact the entity who
					shared the interview with you.
				</p>
				<ul class="mb-4 space-y-1 text-left text-sm">
					{#each validationErrors as err}
						<li class="rounded bg-red-50 px-3 py-2 text-red-700">
							<!-- TODO: Maybe msg should not be displayed? -->
							<span class="font-medium">{err.loc}</span> &mdash; {err.msg}
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{:else if chat}
		<InterviewChat
			{chat}
			{lang}
			{interviewType}
			{interviewConfig}
			{helpTitle}
			{helpText}
			{exitTitle}
			{exitText}
			{exitButtonText}
		/>
	{/if}
</div>

<div data-sveltekit-preload-data="off">
	<LanguagePickerModal
		show={showLanguagePicker}
		languages={availableLanguages}
		onSelect={selectLanguage}
	/>

	<ConsentModal
		show={showConsent && !!consentData}
		title={consentData?.title ?? ''}
		text={consentData?.text ?? ''}
		onAccept={acceptConsent}
		onDecline={declineConsent}
		accepting={consentAccepting}
		animate={false}
	/>

	<WelcomeModal
		show={showWelcome && !!welcomeData}
		title={welcomeData?.title ?? ''}
		text={welcomeData?.text ?? ''}
		videoUrl={welcomeData?.video_file_name ? `/assets/videos/${welcomeData.video_file_name}` : null}
		email={welcomeData?.email ?? null}
		{interviewId}
		onProceed={proceedFromWelcome}
		animate={false}
	/>
</div>

<!-- Loading State -->
{#if isInitializing && !showLanguagePicker && !showConsent && !showWelcome}
	<div class="fixed inset-0 z-200 flex items-center justify-center bg-white">
		<div class="flex flex-col items-center gap-4">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary"
			></div>
			<p class="text-sm text-gray-500">Loading...</p>
		</div>
	</div>
{/if}

<style>
	:global(a) {
		color: #2563eb;
		text-decoration: underline;
		font-weight: 500;
		transition:
			color 0.2s ease,
			text-decoration-color 0.2s ease;

		&:hover {
			color: #1547b0;
		}
		&:active {
			color: #0f2d6e;
		}
	}

	:global(a):visited {
		color: #5203fc;

		&:hover {
			color: #1547b0;
		}
		&:active {
			color: #0f2d6e;
		}
	}
</style>
