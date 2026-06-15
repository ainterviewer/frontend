<script lang="ts">
	import { page } from '$app/state';
	import { Participants } from '$lib/api';
	import type { LanguageDict, ParticipantEmailAttachment } from '$lib/api/types.gen';
	import ProjectLanguagePicker from '$lib/components/projectLanguage/ProjectLanguagePicker.svelte';
	import { Editor } from '@tiptap/core';
	import Image from '@tiptap/extension-image';
	import StarterKit from '@tiptap/starter-kit';
	import { toast } from 'svelte-sonner';

	let { data }: { data: { available_languages: LanguageDict[] } } = $props();

	const project_id = $derived(page.params.project_id as string);
	const language = $derived(page.params.lang as string);
	const isDemo = $derived(page.data.user?.scope === 'demo');
	const availableLanguages = $derived(data.available_languages ?? []);

	type Kind = 'invitation' | 'reminder';

	type KindState = {
		subject: string;
		savedSubject: string;
		templateHtml: string;
		savedHtml: string;
		attachments: ParticipantEmailAttachment[];
		attachmentsLoading: boolean;
		uploadingAttachments: boolean;
		deletingAttachment: string | null;
		loading: boolean;
		saving: boolean;
		sending: boolean;
	};

	function emptyKindState(): KindState {
		return {
			subject: '',
			savedSubject: '',
			templateHtml: '',
			savedHtml: '',
			attachments: [],
			attachmentsLoading: false,
			uploadingAttachments: false,
			deletingAttachment: null,
			loading: true,
			saving: false,
			sending: false
		};
	}

	let kind = $state<Kind>('invitation');
	let states = $state<Record<Kind, KindState>>({
		invitation: emptyKindState(),
		reminder: emptyKindState()
	});

	const current = $derived(states[kind]);
	let exporting = $state(false);

	let editorEl: HTMLDivElement;
	let editor = $state<Editor | null>(null);
	let attachmentInput: HTMLInputElement;

	const dirty = $derived(
		current.templateHtml !== current.savedHtml || current.subject !== current.savedSubject
	);
	const anyDirty = $derived(
		states.invitation.templateHtml !== states.invitation.savedHtml ||
			states.invitation.subject !== states.invitation.savedSubject ||
			states.reminder.templateHtml !== states.reminder.savedHtml ||
			states.reminder.subject !== states.reminder.savedSubject
	);
	const missingInterviewUrl = $derived(
		!!current.templateHtml && !/\{\{\s*interview_url\s*\}\}/.test(current.templateHtml)
	);
	const canSend = $derived(
		!isDemo &&
			!current.sending &&
			!current.saving &&
			!current.loading &&
			!dirty &&
			!!current.subject.trim() &&
			!!current.templateHtml.trim() &&
			!missingInterviewUrl
	);

	const origin = $derived(typeof window !== 'undefined' ? window.location.origin : '');
	const sample = $derived({
		name: 'Jane Doe',
		email: 'jane@example.com',
		pid: 'P-001',
		interview_url: origin ? `${origin}/interview?id=${project_id}&pid=P-001` : '',
		opt_out_url: origin ? `${origin}/opt-out/P-001` : ''
	});

	const placeholders = [
		{ key: 'name', label: 'Name' },
		{ key: 'email', label: 'Email' },
		{ key: 'pid', label: 'PID' },
		{ key: 'interview_url', label: 'Interview URL' },
		{ key: 'opt_out_url', label: 'Opt-out URL' }
	];

	const previewHtml = $derived(
		current.templateHtml.replace(
			/\{\{\s*(name|email|pid|interview_url|opt_out_url)\s*\}\}/g,
			(_, k) => sample[k as keyof typeof sample]
		)
	);

	const sendLabel = $derived(kind === 'reminder' ? 'Send reminders' : 'Send to participants');
	const sendingLabel = $derived(kind === 'reminder' ? 'Sending...' : 'Sending...');
	const confirmSendMessage = $derived(
		kind === 'reminder'
			? 'Send the reminder email to all eligible participants?'
			: 'Send the invitation email to all eligible participants?'
	);
	const introText = $derived(
		kind === 'reminder'
			? 'Compose the reminder email sent to participants who have not yet completed the interview. Use placeholders below to insert each participant’s name, email, PID or personal interview URL.'
			: 'Compose the invitation email sent to participants. Use placeholders below to insert each participant’s name, email, PID or personal interview URL.'
	);

	function setLink() {
		if (!editor) return;
		const prev = editor.getAttributes('link').href ?? '';
		const url = window.prompt(
			'URL (use {{ interview_url }} or {{ opt_out_url }} for personal links)',
			prev
		);
		if (url === null) return;
		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	function insertPlaceholder(key: string) {
		editor?.chain().focus().insertContent(`{{ ${key} }}`).run();
	}

	async function loadTemplate(k: Kind) {
		states[k].loading = true;
		const res =
			k === 'reminder'
				? await Participants.getParticipantReminderEmailTemplate({
						path: { project_id, language }
					})
				: await Participants.getParticipantEmailTemplate({
						path: { project_id, language }
					});
		if (res.error) {
			toast.error(`Failed to load ${k} email template`);
			states[k].templateHtml = '';
			states[k].savedHtml = '';
			states[k].subject = '';
			states[k].savedSubject = '';
		} else {
			states[k].templateHtml = res.data?.template ?? '';
			states[k].savedHtml = states[k].templateHtml;
			states[k].subject = res.data?.subject ?? '';
			states[k].savedSubject = states[k].subject;
		}
		if (k === kind) {
			editor?.commands.setContent(states[k].templateHtml || '', { emitUpdate: false });
		}
		states[k].loading = false;
	}

	async function save() {
		const k = kind;
		states[k].saving = true;
		const body = { subject: states[k].subject || null, template: states[k].templateHtml || null };
		const res =
			k === 'reminder'
				? await Participants.setParticipantReminderEmailTemplate({
						path: { project_id, language },
						body
					})
				: await Participants.setParticipantEmailTemplate({
						path: { project_id, language },
						body
					});
		states[k].saving = false;
		if (res.error) {
			toast.error('Failed to save template');
			return;
		}
		states[k].savedHtml = states[k].templateHtml;
		states[k].savedSubject = states[k].subject;
		toast.success('Template saved');
	}

	async function sendToParticipants() {
		if (!confirm(confirmSendMessage)) return;
		const k = kind;
		states[k].sending = true;
		const res =
			k === 'reminder'
				? await Participants.sendParticipantReminderEmails({
						path: { project_id },
						body: { participant_ids: null }
					})
				: await Participants.sendParticipantEmails({
						path: { project_id },
						body: { participant_ids: null }
					});
		states[k].sending = false;
		if (res.error) {
			toast.error('Failed to send emails');
			return;
		}
		const sent = res.data?.sent.length ?? 0;
		const skipped = res.data?.skipped.length ?? 0;
		const skippedSuffix = skipped ? `, ${skipped} skipped` : '';
		if (sent === 0 && skipped === 0) {
			toast.info('No participants to send to');
		} else if (sent === 0) {
			toast.warning(`No emails sent${skippedSuffix}`);
		} else {
			toast.success(`Sent ${sent} email${sent === 1 ? '' : 's'}${skippedSuffix}`);
		}
	}

	async function exportBundle() {
		exporting = true;
		const res = await Participants.exportEmailBundle({
			path: { project_id },
			parseAs: 'blob'
		});
		exporting = false;
		if (res.error || !res.data) {
			toast.error('Failed to export bundle');
			return;
		}
		const url = window.URL.createObjectURL(res.data as Blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = res.response?.headers.get('x-filename') ?? '';
		document.body.appendChild(a);
		a.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(a);
	}

	function confirmDiscardIfDirty() {
		if (!anyDirty) return true;
		return confirm('You have unsaved changes. Discard them and switch language?');
	}

	function switchKind(next: Kind) {
		if (next === kind) return;
		kind = next;
		editor?.commands.setContent(states[next].templateHtml || '', { emitUpdate: false });
	}

	async function loadAttachments(k: Kind) {
		states[k].attachmentsLoading = true;
		const res =
			k === 'reminder'
				? await Participants.listParticipantReminderEmailAttachments({
						path: { project_id, language }
					})
				: await Participants.listParticipantEmailAttachments({
						path: { project_id, language }
					});
		if (!res.error) {
			states[k].attachments = res.data ?? [];
		}
		states[k].attachmentsLoading = false;
	}

	async function uploadAttachments(files: FileList) {
		if (!files.length) return;
		const k = kind;
		states[k].uploadingAttachments = true;
		const res =
			k === 'reminder'
				? await Participants.uploadParticipantReminderEmailAttachments({
						path: { project_id, language },
						body: { files: Array.from(files) }
					})
				: await Participants.uploadParticipantEmailAttachments({
						path: { project_id, language },
						body: { files: Array.from(files) }
					});
		states[k].uploadingAttachments = false;
		if (res.error) {
			toast.error('Failed to upload attachments');
			return;
		}
		states[k].attachments = res.data ?? [];
		toast.success(`Uploaded ${files.length} attachment${files.length === 1 ? '' : 's'}`);
	}

	async function deleteAttachment(filename: string) {
		const k = kind;
		states[k].deletingAttachment = filename;
		const res =
			k === 'reminder'
				? await Participants.deleteParticipantReminderEmailAttachment({
						path: { project_id, language, filename }
					})
				: await Participants.deleteParticipantEmailAttachment({
						path: { project_id, language, filename }
					});
		states[k].deletingAttachment = null;
		if (res.error) {
			toast.error('Failed to delete attachment');
			return;
		}
		states[k].attachments = res.data ?? [];
	}

	function formatBytes(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	$effect(() => {
		editor = new Editor({
			element: editorEl,
			extensions: [
				StarterKit.configure({ link: { openOnClick: false } }),
				Image.configure({
					inline: true,
					allowBase64: true
				})
			],
			content: '',
			editorProps: {
				attributes: {
					class: 'prose prose-sm max-w-none min-h-[260px] px-3 py-2 focus:outline-none'
				}
			},
			onUpdate: ({ editor: e }) => {
				states[kind].templateHtml = e.getHTML();
			}
		});
		return () => {
			editor?.destroy();
			editor = null;
		};
	});

	$effect(() => {
		// re-fetch when project or language changes
		void project_id;
		void language;
		loadTemplate('invitation');
		loadTemplate('reminder');
		loadAttachments('invitation');
		loadAttachments('reminder');
	});
</script>

<div class="">
	<div class="mb-2">
		<h1 class="page-title">Email templates</h1>
	</div>

	<div class="mb-3 flex gap-1 border-b border-gray-200">
		<button
			type="button"
			class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
			class:border-primary={kind === 'invitation'}
			class:text-primary={kind === 'invitation'}
			class:border-transparent={kind !== 'invitation'}
			class:text-gray-500={kind !== 'invitation'}
			class:hover:text-gray-700={kind !== 'invitation'}
			onclick={() => switchKind('invitation')}
		>
			Invitation
		</button>
		<button
			type="button"
			class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
			class:border-primary={kind === 'reminder'}
			class:text-primary={kind === 'reminder'}
			class:border-transparent={kind !== 'reminder'}
			class:text-gray-500={kind !== 'reminder'}
			class:hover:text-gray-700={kind !== 'reminder'}
			onclick={() => switchKind('reminder')}
		>
			Reminder
		</button>
	</div>

	<p class="mb-4 text-gray-600">{introText}</p>

	<div class="mb-3 flex flex-wrap items-center gap-2 text-sm">
		<span class="text-gray-500">Insert:</span>
		{#each placeholders as p (p.key)}
			<button
				type="button"
				class="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-700 hover:bg-gray-100"
				onclick={() => insertPlaceholder(p.key)}
				disabled={isDemo}
			>
				{`{{ ${p.key} }}`}
			</button>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<div class="rounded-lg border border-gray-200 bg-white shadow">
			<div class="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
				<label for="email-subject" class="text-sm font-semibold text-gray-700">Subject</label>
				<input
					id="email-subject"
					type="text"
					class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none disabled:bg-gray-50 disabled:opacity-60"
					placeholder="Email subject"
					bind:value={states[kind].subject}
					disabled={isDemo || current.loading}
					autocomplete="off"
				/>
			</div>
			<div class="flex flex-wrap items-center gap-1 border-b border-gray-200 px-2 py-1.5">
				<button
					type="button"
					class="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('bold')}
					onclick={() => editor?.chain().focus().toggleBold().run()}
					disabled={!editor || isDemo}
					title="Bold"
					aria-label="Bold"
				>
					<i class="fa-solid fa-bold"></i>
				</button>
				<button
					type="button"
					class="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('italic')}
					onclick={() => editor?.chain().focus().toggleItalic().run()}
					disabled={!editor || isDemo}
					title="Italic"
					aria-label="Italic"
				>
					<i class="fa-solid fa-italic"></i>
				</button>
				<button
					type="button"
					class="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('strike')}
					onclick={() => editor?.chain().focus().toggleStrike().run()}
					disabled={!editor || isDemo}
					title="Strikethrough"
					aria-label="Strikethrough"
				>
					<i class="fa-solid fa-strikethrough"></i>
				</button>
				<span class="mx-1 h-5 w-px bg-gray-200"></span>
				<button
					type="button"
					class="relative rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('heading', { level: 1 })}
					onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
					disabled={!editor || isDemo}
					title="Heading 1"
					aria-label="Heading 1"
				>
					<i class="fa-solid fa-heading"></i>
					<span class="ml-0.5 align-super text-[10px] font-semibold">1</span>
				</button>
				<button
					type="button"
					class="relative rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('heading', { level: 2 })}
					onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
					disabled={!editor || isDemo}
					title="Heading 2"
					aria-label="Heading 2"
				>
					<i class="fa-solid fa-heading"></i>
					<span class="ml-0.5 align-super text-[10px] font-semibold">2</span>
				</button>
				<button
					type="button"
					class="relative rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('heading', { level: 3 })}
					onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
					disabled={!editor || isDemo}
					title="Heading 3"
					aria-label="Heading 3"
				>
					<i class="fa-solid fa-heading"></i>
					<span class="ml-0.5 align-super text-[10px] font-semibold">3</span>
				</button>
				<button
					type="button"
					class="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('bulletList')}
					onclick={() => editor?.chain().focus().toggleBulletList().run()}
					disabled={!editor || isDemo}
					title="Bullet list"
					aria-label="Bullet list"
				>
					<i class="fa-solid fa-list-ul"></i>
				</button>
				<button
					type="button"
					class="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('orderedList')}
					onclick={() => editor?.chain().focus().toggleOrderedList().run()}
					disabled={!editor || isDemo}
					title="Numbered list"
					aria-label="Numbered list"
				>
					<i class="fa-solid fa-list-ol"></i>
				</button>
				<span class="mx-1 h-5 w-px bg-gray-200"></span>
				<button
					type="button"
					class="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					class:bg-gray-200={editor?.isActive('link')}
					onclick={setLink}
					disabled={!editor || isDemo}
					title="Link"
					aria-label="Link"
				>
					<i class="fa-solid fa-link"></i>
				</button>
				<button
					type="button"
					class="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					onclick={() => editor?.chain().focus().undo().run()}
					disabled={!editor || isDemo}
					title="Undo"
					aria-label="Undo"
				>
					<i class="fa-solid fa-rotate-left"></i>
				</button>
				<button
					type="button"
					class="rounded px-2 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
					onclick={() => editor?.chain().focus().redo().run()}
					disabled={!editor || isDemo}
					title="Redo"
					aria-label="Redo"
				>
					<i class="fa-solid fa-rotate-right"></i>
				</button>
			</div>
			<div bind:this={editorEl} class="min-h-[260px]"></div>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white shadow">
			<div class="flex items-center justify-between border-b border-gray-200 px-3 py-2">
				<span class="text-sm font-semibold text-gray-700">Preview</span>
				<span class="text-xs text-gray-500">
					Sample: {sample.name} &middot; {sample.email} &middot; {sample.pid}
				</span>
			</div>
			<div class="px-3 py-2">
				{#if !current.subject && !current.templateHtml}
					<p class="text-sm text-gray-400">Nothing to preview yet.</p>
				{:else}
					{#if current.subject}
						<div class="mb-2 border-b border-gray-100 pb-2 text-sm">
							<span class="font-semibold text-gray-700">Subject:</span>
							<span class="text-gray-800">{current.subject}</span>
						</div>
					{/if}
					<div class="prose prose-sm max-w-none">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html previewHtml}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="mt-4 rounded-lg border border-gray-200 bg-white shadow">
		<div class="flex items-center justify-between border-b border-gray-200 px-3 py-2">
			<span class="text-sm font-semibold text-gray-700">Attachments</span>
			<div class="flex items-center gap-2">
				{#if current.attachmentsLoading}
					<span class="text-xs text-gray-400">Loading...</span>
				{/if}
				<input
					bind:this={attachmentInput}
					type="file"
					multiple
					class="hidden"
					onchange={(e) => {
						const files = (e.currentTarget as HTMLInputElement).files;
						if (files) uploadAttachments(files);
					}}
					disabled={isDemo || current.uploadingAttachments}
				/>
				<button
					type="button"
					class="flex items-center gap-1.5 rounded border border-gray-300 bg-gray-50 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
					onclick={() => attachmentInput.click()}
					disabled={isDemo || current.uploadingAttachments}
				>
					<i class="fa-solid fa-paperclip"></i>
					{current.uploadingAttachments ? 'Uploading...' : 'Add files'}
				</button>
			</div>
		</div>
		<div class="px-3 py-2">
			{#if current.attachments.length === 0 && !current.attachmentsLoading}
				<p class="text-sm text-gray-400">
					No attachments. Files added here will be included in every outgoing {kind} email.
				</p>
			{:else}
				<ul class="divide-y divide-gray-100">
					{#each current.attachments as attachment (attachment.filename)}
						<li class="flex items-center justify-between py-1.5">
							<div class="flex min-w-0 items-center gap-2">
								<i class="fa-solid fa-file text-xs text-gray-400"></i>
								<span class="truncate text-sm text-gray-800">{attachment.filename}</span>
								<span class="shrink-0 text-xs text-gray-400">{formatBytes(attachment.size)}</span>
								{#if attachment.content_type}
									<span class="shrink-0 text-xs text-gray-400">{attachment.content_type}</span>
								{/if}
							</div>
							<button
								type="button"
								class="ml-3 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
								onclick={() => deleteAttachment(attachment.filename)}
								disabled={isDemo || current.deletingAttachment === attachment.filename}
								title="Remove attachment"
								aria-label="Remove attachment"
							>
								<i class="fa-solid fa-trash text-xs"></i>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<div
		class="sticky bottom-0 mt-4 ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
	>
		<ProjectLanguagePicker
			projectId={project_id}
			currentLang={language}
			{availableLanguages}
			canSwitch={confirmDiscardIfDirty}
		/>
		<button
			type="button"
			class="flex items-center gap-2 rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
			onclick={exportBundle}
			disabled={isDemo || exporting || anyDirty}
			title={anyDirty
				? 'Save your changes before exporting'
				: 'Download a self-contained zip with participants, templates and attachments'}
		>
			<i class="fa-solid fa-file-zipper"></i>
			{exporting ? 'Exporting...' : 'Export bundle'}
		</button>
		<button
			type="button"
			class="flex items-center gap-2 rounded-full bg-gray-100 px-6 py-2 font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
			onclick={save}
			disabled={isDemo || current.saving || current.loading || !dirty}
			title="Save template"
		>
			<i class="fa-solid fa-floppy-disk"></i>
			{current.saving ? 'Saving...' : 'Save'}
		</button>
		<button
			type="button"
			class="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-medium text-white shadow-sm hover:bg-dark disabled:opacity-50"
			onclick={sendToParticipants}
			disabled={!canSend}
			title={dirty
				? 'Save your changes before sending'
				: !current.subject.trim()
					? 'Subject is empty'
					: missingInterviewUrl
						? 'Template must include {{ interview_url }}'
						: !current.templateHtml.trim()
							? 'Template is empty'
							: sendLabel}
		>
			<i class="fa-solid fa-paper-plane"></i>
			{current.sending ? sendingLabel : sendLabel}
		</button>
	</div>
</div>
