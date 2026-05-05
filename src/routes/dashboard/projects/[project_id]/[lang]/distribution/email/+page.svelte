<script lang="ts">
	import { page } from '$app/state';
	import { Participants } from '$lib/api';
	import type { LanguageDict, ParticipantEmailAttachment } from '$lib/api/types.gen';
	import ProjectLanguagePicker from '$lib/components/projectLanguage/ProjectLanguagePicker.svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import { toast } from 'svelte-sonner';

	let { data }: { data: { available_languages: LanguageDict[] } } = $props();

	const project_id = $derived(page.params.project_id as string);
	const language = $derived(page.params.lang as string);
	const isDemo = $derived(page.data.user?.scope === 'demo');
	const availableLanguages = $derived(data.available_languages ?? []);

	let editorEl: HTMLDivElement;
	let editor = $state<Editor | null>(null);
	let subject = $state('');
	let savedSubject = $state('');
	let templateHtml = $state('');
	let savedHtml = $state('');
	let loading = $state(true);
	let saving = $state(false);
	let sending = $state(false);

	// Attachments
	let attachments = $state<ParticipantEmailAttachment[]>([]);
	let attachmentsLoading = $state(false);
	let uploadingAttachments = $state(false);
	let deletingAttachment = $state<string | null>(null);
	let attachmentInput: HTMLInputElement;

	const dirty = $derived(templateHtml !== savedHtml || subject !== savedSubject);
	const missingInterviewUrl = $derived(
		!!templateHtml && !/\{\{\s*interview_url\s*\}\}/.test(templateHtml)
	);
	const canSend = $derived(
		!isDemo &&
			!sending &&
			!saving &&
			!loading &&
			!dirty &&
			!!subject.trim() &&
			!!templateHtml.trim() &&
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
		templateHtml.replace(
			/\{\{\s*(name|email|pid|interview_url|opt_out_url)\s*\}\}/g,
			(_, k) => sample[k as keyof typeof sample]
		)
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

	async function load() {
		loading = true;
		const res = await Participants.getParticipantEmailTemplate({
			path: { project_id, language }
		});
		if (res.error) {
			toast.error('Failed to load email template');
			templateHtml = '';
			savedHtml = '';
			subject = '';
			savedSubject = '';
		} else {
			templateHtml = res.data?.template ?? '';
			savedHtml = templateHtml;
			subject = res.data?.subject ?? '';
			savedSubject = subject;
		}
		editor?.commands.setContent(templateHtml || '', { emitUpdate: false });
		loading = false;
	}

	async function save() {
		saving = true;
		const res = await Participants.setParticipantEmailTemplate({
			path: { project_id, language },
			body: { subject: subject || null, template: templateHtml || null }
		});
		saving = false;
		if (res.error) {
			toast.error('Failed to save template');
			return;
		}
		savedHtml = templateHtml;
		savedSubject = subject;
		toast.success('Template saved');
	}

	async function sendToParticipants() {
		if (!confirm('Send the invitation email to all eligible participants?')) return;
		sending = true;
		const res = await Participants.sendParticipantEmails({
			path: { project_id },
			body: { participant_ids: null }
		});
		sending = false;
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

	function confirmDiscardIfDirty() {
		if (!dirty) return true;
		return confirm('You have unsaved changes. Discard them and switch language?');
	}

	async function loadAttachments() {
		attachmentsLoading = true;
		const res = await Participants.listParticipantEmailAttachments({
			path: { project_id, language }
		});
		if (!res.error) {
			attachments = res.data ?? [];
		}
		attachmentsLoading = false;
	}

	async function uploadAttachments(files: FileList) {
		if (!files.length) return;
		uploadingAttachments = true;
		const res = await Participants.uploadParticipantEmailAttachments({
			path: { project_id, language },
			body: { files: Array.from(files) }
		});
		uploadingAttachments = false;
		if (res.error) {
			toast.error('Failed to upload attachments');
			return;
		}
		attachments = res.data ?? [];
		toast.success(`Uploaded ${files.length} attachment${files.length === 1 ? '' : 's'}`);
	}

	async function deleteAttachment(filename: string) {
		deletingAttachment = filename;
		const res = await Participants.deleteParticipantEmailAttachment({
			path: { project_id, language, filename }
		});
		deletingAttachment = null;
		if (res.error) {
			toast.error('Failed to delete attachment');
			return;
		}
		attachments = res.data ?? [];
	}

	function formatBytes(bytes: number) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	$effect(() => {
		editor = new Editor({
			element: editorEl,
			extensions: [StarterKit.configure({ link: { openOnClick: false } })],
			content: '',
			editorProps: {
				attributes: {
					class: 'prose prose-sm max-w-none min-h-[260px] px-3 py-2 focus:outline-none'
				}
			},
			onUpdate: ({ editor: e }) => {
				templateHtml = e.getHTML();
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
		load();
		loadAttachments();
	});
</script>

<div class="">
	<div class="mb-2">
		<h1 class="page-title">Email template</h1>
	</div>

	<p class="mb-4 text-gray-600">
		Compose the invitation email sent to participants. Use placeholders below to insert each
		participant's name, email, PID or personal interview URL.
	</p>

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
					bind:value={subject}
					disabled={isDemo || loading}
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
				{#if !subject && !templateHtml}
					<p class="text-sm text-gray-400">Nothing to preview yet.</p>
				{:else}
					{#if subject}
						<div class="mb-2 border-b border-gray-100 pb-2 text-sm">
							<span class="font-semibold text-gray-700">Subject:</span>
							<span class="text-gray-800">{subject}</span>
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
				{#if attachmentsLoading}
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
					disabled={isDemo || uploadingAttachments}
				/>
				<button
					type="button"
					class="flex items-center gap-1.5 rounded border border-gray-300 bg-gray-50 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
					onclick={() => attachmentInput.click()}
					disabled={isDemo || uploadingAttachments}
				>
					<i class="fa-solid fa-paperclip"></i>
					{uploadingAttachments ? 'Uploading...' : 'Add files'}
				</button>
			</div>
		</div>
		<div class="px-3 py-2">
			{#if attachments.length === 0 && !attachmentsLoading}
				<p class="text-sm text-gray-400">
					No attachments. Files added here will be included in every outgoing email.
				</p>
			{:else}
				<ul class="divide-y divide-gray-100">
					{#each attachments as attachment (attachment.filename)}
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
								disabled={isDemo || deletingAttachment === attachment.filename}
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
			onclick={save}
			disabled={isDemo || saving || loading || !dirty}
			title="Save template"
		>
			<i class="fa-solid fa-floppy-disk"></i>
			{saving ? 'Saving...' : 'Save'}
		</button>
		<button
			type="button"
			class="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-medium text-white shadow-sm hover:bg-dark disabled:opacity-50"
			onclick={sendToParticipants}
			disabled={!canSend}
			title={dirty
				? 'Save your changes before sending'
				: !subject.trim()
					? 'Subject is empty'
					: missingInterviewUrl
						? 'Template must include {{ interview_url }}'
						: !templateHtml.trim()
							? 'Template is empty'
							: 'Send to participants'}
		>
			<i class="fa-solid fa-paper-plane"></i>
			{sending ? 'Sending...' : 'Send to participants'}
		</button>
	</div>
</div>
