<script lang="ts">
	import { Projects as Api } from '$lib/api';
	import type { InterviewResumeLinkPublic } from '$lib/api/types.gen';
	import { formatDate } from '$lib/components/table/features';
	import { toast } from 'svelte-sonner';

	interface Props {
		open: boolean;
		projectId: string;
		/** The interview a link would unlock. Null while the modal is closed. */
		interviewId: string | null;
		/** Shown so the member can confirm they're on the right respondent. */
		pid: string | null | undefined;
		onClose: () => void;
	}

	let { open, projectId, interviewId, pid, onClose }: Props = $props();

	let link = $state<InterviewResumeLinkPublic | null>(null);
	let loading = $state(false);
	let working = $state(false);
	let error = $state<string | null>(null);
	// Set only by a successful mint. The backend stores a hash, so this is the
	// one and only time the URL exists anywhere we can show it.
	let freshUrl = $state<string | null>(null);
	let copied = $state(false);

	function close() {
		onClose();
	}

	// Reset on every open rather than on close, so a freshly minted URL can
	// never be left on screen for the next interview the member opens.
	$effect(() => {
		if (!open || !interviewId) return;
		link = null;
		freshUrl = null;
		copied = false;
		error = null;
		void load(interviewId);
	});

	async function load(id: string) {
		loading = true;
		const { data, error: apiError } = await Api.getInterviewResumeLink({
			path: { project_id: projectId, interview_id: id }
		});
		loading = false;
		if (apiError) {
			error = 'Could not check whether a link is outstanding.';
			return;
		}
		link = data ?? null;
	}

	/** The message body of a FastAPI error, when it carries one. */
	function detail(apiError: unknown, fallback: string) {
		return typeof apiError === 'object' && apiError && 'detail' in apiError
			? String((apiError as { detail: unknown }).detail)
			: fallback;
	}

	async function generate() {
		if (!interviewId) return;
		working = true;
		error = null;
		const { data, error: apiError } = await Api.createInterviewResumeLink({
			path: { project_id: projectId, interview_id: interviewId }
		});
		working = false;
		if (apiError || !data) {
			error = detail(apiError, 'Could not create a resume link.');
			return;
		}
		freshUrl = data.url;
		copied = false;
		await load(interviewId);
	}

	async function revoke() {
		if (!interviewId) return;
		working = true;
		error = null;
		const { data, error: apiError } = await Api.revokeInterviewResumeLink({
			path: { project_id: projectId, interview_id: interviewId }
		});
		working = false;
		if (apiError) {
			error = detail(apiError, 'Could not revoke the link.');
			return;
		}
		link = data ?? null;
		freshUrl = null;
		toast.success('Resume link revoked');
	}

	async function copy() {
		if (!freshUrl) return;
		try {
			await navigator.clipboard.writeText(freshUrl);
			copied = true;
		} catch {
			// Clipboard access can be refused outright; the URL is selectable in
			// the field either way, so say so rather than failing silently.
			toast.error('Could not copy — select the link and copy it manually.');
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	const status = $derived.by(() => {
		if (!link) return null;
		if (link.redeemed_at)
			return { tone: 'spent', text: `Used on ${formatDate(link.redeemed_at)}.` };
		if (link.revoked_at) return { tone: 'spent', text: 'Revoked.' };
		if (!link.redeemable)
			return { tone: 'spent', text: `Expired on ${formatDate(link.expires_at)}.` };
		return {
			tone: 'live',
			text: `Outstanding since ${formatDate(link.created_at)}, not used yet. Expires ${formatDate(link.expires_at)}.`
		};
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="resume-link-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default"
			aria-label="Close"
			onclick={close}
			tabindex="-1"
		></button>

		<div
			class="animate-in fade-in zoom-in-95 relative w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5 duration-150"
		>
			<div class="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
				<div class="flex items-start gap-3">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
					>
						<i class="fa-solid fa-link"></i>
					</div>
					<div>
						<h3 id="resume-link-title" class="text-base font-semibold text-gray-900">
							Resume link
						</h3>
						<p class="mt-1 text-sm text-gray-500">
							Lets {#if pid}<span class="font-mono font-medium text-gray-700">{pid}</span
								>{:else}this respondent{/if} finish this interview in any browser.
						</p>
					</div>
				</div>
				<button
					type="button"
					class="-mt-1 -mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
					onclick={close}
					aria-label="Close"
				>
					<i class="fa-solid fa-xmark"></i>
				</button>
			</div>

			<div class="space-y-4 px-6 pb-2">
				{#if error}
					<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
						{error}
					</div>
				{/if}

				{#if freshUrl}
					<div class="rounded-lg border border-primary/30 bg-primary/5 p-3">
						<p class="text-sm font-medium text-dark">Copy this now — it won't be shown again.</p>
						<div class="mt-2 flex gap-2">
							<input
								type="text"
								readonly
								value={freshUrl}
								class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-800 focus:border-primary focus:outline-none"
								onfocus={(e) => e.currentTarget.select()}
							/>
							<button
								type="button"
								class="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
								onclick={copy}
							>
								<i class="fa-solid {copied ? 'fa-check' : 'fa-copy'} mr-1 text-xs"></i>
								{copied ? 'Copied' : 'Copy'}
							</button>
						</div>
						<p class="mt-2 text-xs text-gray-600">
							Only the hash is stored, so it can't be recovered later. Issuing another link revokes
							this one.
						</p>
					</div>
				{:else if loading}
					<p class="text-sm text-gray-500">Checking…</p>
				{:else if status}
					<div
						class="rounded-lg border p-3 text-sm {status.tone === 'live'
							? 'border-amber-200 bg-amber-50 text-amber-900'
							: 'border-gray-200 bg-gray-50 text-gray-600'}"
					>
						{status.text}
					</div>
				{:else}
					<p class="text-sm text-gray-500">No resume link has been issued for this interview.</p>
				{/if}

				<p class="text-xs text-gray-500">
					A resume link works once and gives whoever opens it access to this interview's transcript.
					Send it only to the respondent it belongs to.
				</p>
			</div>

			<div class="flex items-center justify-end gap-2 px-6 py-4">
				{#if link?.redeemable}
					<button
						type="button"
						class="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
						onclick={revoke}
						disabled={working}
					>
						Revoke
					</button>
				{/if}
				<button
					type="button"
					class="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
					onclick={close}
				>
					Close
				</button>
				<button
					type="button"
					class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={generate}
					disabled={working || loading}
				>
					{working ? 'Working…' : link ? 'Issue a new link' : 'Create link'}
				</button>
			</div>
		</div>
	</div>
{/if}
