<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { guideConditions, questionKey } from '$lib/analysis/conditions';
	import { type Image, type MessagePublic } from '$lib/api';
	import type { InterviewGuide } from '$lib/api/types.gen';
	import type { Code } from '$lib/coding/codingTree';
	import CodedMessage from '$lib/components/analysis/CodedMessage.svelte';
	import MessageCommentModal from '$lib/components/analysis/MessageCommentModal.svelte';
	import AudioPlayer from '$lib/components/interview/AudioPlayer.svelte';
	import { securityFields } from '$lib/components/interview/security';
	import SecurityEvent from '$lib/components/interview/SecurityEvent.svelte';
	import type { Message } from '$lib/components/interview/types';
	import { CommentSurface } from '$lib/stores/commentSurface.svelte';
	import { MessageCodings } from '$lib/stores/messageCodings.svelte';
	import { MessageComments } from '$lib/stores/messageComments.svelte';

	interface InterviewData {
		messages: MessagePublic[];
		/**
		 * The project's codebook, loaded with the transcript. Read-only here:
		 * this page applies codes, it does not edit the codebook.
		 */
		codes: Code[];
		/**
		 * The project's guide, for the conditions its questions carry. Null
		 * where it could not be read, which costs the condition notes and
		 * nothing else.
		 */
		guide?: InterviewGuide | null;
		project_id: string;
		lang: string;
		interview_id: string;
		error: string | null;
	}

	let {
		data,
		backLink
	}: {
		data: InterviewData;
		backLink: string;
	} = $props();

	// Get user ID from the layout data
	let userId = $derived(page.data.user?.id || '');
	// Moderation (editing or deleting someone else's comment) is the project's
	// to grant: platform admin, project owner, or folder admin. The server says
	// which, so the buttons match what the API will actually accept.
	let canModerate = $derived(page.data.permissions?.can_moderate ?? false);

	// Codings are per coder: this reader's are the editable ones, everybody
	// else's are shown named and read-only. Comments are a separate, threaded
	// discussion.
	const codings = new MessageCodings(() => data.project_id);
	const comments = new MessageComments(() => data.project_id);

	// Initialize codings and comment threads from server data
	$effect(() => {
		codings.clear();
		comments.clear();
		if (data.messages) {
			codings.seed(data.messages);
			comments.seed(data.messages);
		}
	});

	// UI state
	let activeCodingMessageId = $state<string | null>(null);
	const surface = new CommentSurface();

	$effect(() => {
		surface.syncWidth();
	});

	/** The guide's conditions, keyed by question. Empty without a guide. */
	let conditions = $derived(guideConditions(data.guide));

	// Transform API messages to ChatClient Message format
	let messages = $derived.by(() => {
		if (!data.messages) return [];

		// A gate belongs to the question, not to any one message inside it, so
		// it is stated on the first message of the group and not again on its
		// probes — a question with three probes would otherwise repeat the same
		// sentence four times down the transcript.
		// A plain record rather than a Set: scratch inside a derived, rebuilt on
		// every run, never read as state.
		const stated: Record<string, true> = {};

		const conditionFor = (msg: MessagePublic): string | null => {
			if (msg.section === null || msg.section === undefined) return null;
			if (msg.main_question === null || msg.main_question === undefined) return null;
			const key = questionKey(msg.section, msg.main_question);
			if (stated[key]) return null;
			const text = conditions.get(key)?.text ?? null;
			// Only a stated rule closes the group: a question with no gate must
			// not stop a later one from showing its own.
			if (text) stated[key] = true;
			return text;
		};

		const transformed = data.messages.map((msg) => {
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
						if (typeof img.data === 'string') {
							image = {
								data: img.data,
								alt: img.alt,
								primer: img.primer || undefined
							};
						}
					}
				} else {
					const img = msg.image as Image;
					if (typeof img.data === 'string') {
						image = {
							data: img.data,
							alt: img.alt,
							primer: img.primer || undefined
						};
					}
				}
			}

			// Construct question label
			let question_label: string | undefined = undefined;
			if (msg.section !== undefined && msg.section !== null) {
				question_label = `${msg.section + 1}`;
				if (msg.main_question !== undefined && msg.main_question !== null) {
					question_label += `.${msg.main_question + 1}`;
					// sub_question = 0 means main question, sub_question > 0 means probe
					if (msg.sub_question) {
						question_label += `.${msg.sub_question}`;
					}
				}
			}

			return {
				id: msg.id,
				text: msg.content,
				type,
				message_id: msg.message_id,
				skipped_by_condition: msg.skipped_by_condition,
				feedback: msg.feedback,
				survey_item: msg.survey_item,
				image: image,
				can_answer: msg.can_answer,
				user_image: false,
				audio_file: msg.audio_file,
				question_label,
				// The rule this question is subject to, resolved here rather than
				// looked up per bubble. A skipped question is drawn faded and
				// otherwise unexplained; a conditional one that *was* asked
				// looks like any other, which is the more misleading of the two.
				condition: conditionFor(msg),
				section: msg.section,
				options: undefined,
				required: false,
				...securityFields(msg)
			} as Message & { id: string };
		});

		// In the transcript, survey items belong to the user's answer bubble:
		// move survey_item from the assistant question onto the following user message.
		let pendingSurvey: Message['survey_item'] | null = null;
		return transformed.map((m) => {
			if (m.type === 'received' && m.survey_item) {
				pendingSurvey = m.survey_item;
				return { ...m, survey_item: undefined };
			}
			if (m.type === 'sent' && pendingSurvey) {
				const withSurvey = {
					...m,
					survey_item: pendingSurvey,
					answer: m.text,
					text: undefined
				};
				pendingSurvey = null;
				return withSurvey;
			}
			return m;
		});
	});

	/**
	 * Applying a code is one write, and a complete one — unlike the annotation
	 * envelope it replaces, which resent a coder's whole reading of a message
	 * on every click.
	 */
	async function applyCode(
		messageId: string,
		codeId: string,
		span: { start: number; end: number } | null,
		value: number | null
	) {
		await codings.add(messageId, {
			code_id: codeId,
			start_offset: span?.start ?? null,
			end_offset: span?.end ?? null,
			value_int: value
		});
	}

	async function changeScore(messageId: string, codingId: string, value: number) {
		const existing = codings.get(messageId).find((coding) => coding.id === codingId);
		if (!existing) return;
		await codings.update(messageId, codingId, {
			code_id: existing.code_id,
			start_offset: existing.start_offset ?? null,
			end_offset: existing.end_offset ?? null,
			value_int: value
		});
	}

	// Nothing to code with means nothing to offer: the badge would open a panel
	// with an empty codebook in it.
	let hasCodebook = $derived((data.codes?.length ?? 0) > 0);
</script>

<div
	class="flex h-[calc(100vh-8.5rem)] w-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white"
>
	<!-- Header -->
	<header class="flex items-center justify-between border-b px-6 py-4">
		<div class="flex items-center gap-4">
			<a
				href={resolve(backLink as '/')}
				class="text-gray-500 transition-colors hover:text-gray-700"
				aria-label="Back"
			>
				<i class="fa-solid fa-arrow-left text-lg"></i>
			</a>
			<div class="flex flex-col">
				<h1 class="text-xl font-semibold text-gray-800">Interview Transcript</h1>
				<span class="text-sm text-gray-500">ID: {data.interview_id}</span>
			</div>
		</div>
		{#if hasCodebook}
			<div class="text-xs text-gray-500">
				<i class="fa-solid fa-tags mr-1"></i>
				Hover a message to code or comment on it
			</div>
		{/if}
	</header>

	<!-- Messages Area -->
	<div class="flex-1 overflow-y-auto bg-gray-50 p-4 xl:pr-[320px]" style="overflow-x: clip;">
		<div class="mx-auto min-h-full max-w-4xl rounded-lg bg-white p-6 shadow-sm">
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
					{#each messages as msg, i (msg.message_id || msg.id)}
						{@const messageId = msg.id as string}

						{#if msg.section !== undefined && msg.section !== null && (i === 0 || messages[i - 1].section !== msg.section)}
							<div class="relative my-6 flex items-center">
								<div class="flex-grow border-t border-gray-200"></div>
								<span
									class="mx-4 flex-shrink text-xs font-bold tracking-widest text-gray-400 uppercase"
								>
									Section {msg.section + 1}
								</span>
								<div class="flex-grow border-t border-gray-200"></div>
							</div>
						{/if}

						{#if msg.security}
							<SecurityEvent event={msg.security} text={msg.text} />
						{:else if msg.type === 'system'}
							<div class="my-2 text-center text-sm text-gray-500 select-none">{msg.text}</div>
						{:else}
							<CodedMessage
								message={msg}
								{messageId}
								content={msg.text ?? ''}
								lang={data.lang}
								codes={data.codes}
								codings={codings.get(messageId)}
								{comments}
								{surface}
								currentUserId={userId}
								{canModerate}
								canCode={hasCodebook}
								codingOpen={activeCodingMessageId === messageId}
								savingCoding={codings.isPending(messageId)}
								onToggleCoding={() =>
									(activeCodingMessageId = activeCodingMessageId === messageId ? null : messageId)}
								onApply={(codeId, span, value) => applyCode(messageId, codeId, span, value)}
								onChangeValue={(codingId, value) => changeScore(messageId, codingId, value)}
								onRemoveCoding={(codingId) => codings.remove(messageId, codingId)}
								onCancelCoding={() => (activeCodingMessageId = null)}
							>
								{#snippet underMessage()}
									<!-- Original voice recording of a transcribed message -->
									{#if msg.audio_file}
										<div
											class="mt-1 flex {msg.type === 'received'
												? 'ml-2.5 sm:ml-[50px]'
												: 'mr-2.5 justify-end sm:mr-[50px]'}"
										>
											<AudioPlayer
												src="/api/projects/{data.project_id}/interviews/{data.interview_id}/audio/{msg.audio_file}"
											/>
										</div>
									{/if}
								{/snippet}
							</CodedMessage>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Comment thread modal, where the screen has no room for a margin card -->
<MessageCommentModal {comments} {surface} currentUserId={userId} {canModerate} />

<svelte:window
	onresize={() => surface.syncWidth()}
	onkeydown={(e) => {
		// Escape closes whichever comment surface is open — the modal on narrow
		// screens, the margin threads on wide ones — wherever focus happens to
		// be. Unless the thread already used the key to back out of a reply or
		// edit box, which is the more local meaning of the same press.
		if (e.key !== 'Escape' || e.defaultPrevented) return;
		surface.closeTopmost();
	}}
/>
