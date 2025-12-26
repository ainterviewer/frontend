<script lang="ts">
	import { page } from '$app/state';
	import { Projects } from '$lib/api';

	interface Props {
		initialData?: { title: string; text: string } | null;
	}

	let { initialData = null }: Props = $props();

	let projectId = $derived(page.params.project_id ?? '');
	let language = $derived(page.params.lang ?? '');
	// svelte-ignore state_referenced_locally
	let title = $state(initialData?.title || '');
	// svelte-ignore state_referenced_locally
	let text = $state(initialData?.text || '');
	let showModal = $state(false);
	let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	async function saveConsent() {
		const { error } = await Projects.createConsent({
			path: { project_id: projectId, language: language },
			body: { title, text }
		});

		if (!error) {
			showNotification('success', 'Consent saved.');
		} else {
			showNotification('error', 'Error when saving consent.');
		}
	}

	function showNotification(type: 'success' | 'error', message: string) {
		notification = { type, message };
		setTimeout(() => (notification = null), 3000);
	}
</script>

<h1 class="page-title">Consent</h1>
<p class="my-4">
	Fill out the consent message you want the user to accept before they can start the interview.
</p>

<form class="flex flex-col gap-4">
	<div class="flex flex-col">
		<label for="consent-title" class="mt-4 mb-2 block">Title</label>
		<input
			id="consent-title"
			bind:value={title}
			placeholder="Welcome to AInterviewer"
			class="w-full flex-1 rounded border border-gray-300 p-2"
		/>
	</div>
	<div class="flex flex-col">
		<label for="consent-text" class="mt-4 mb-2 block">Message</label>
		<textarea
			id="consent-text"
			bind:value={text}
			placeholder="Write the consent messages of your interview here."
			rows="10"
			class="min-h-60 w-full resize-y overflow-y-auto rounded border border-gray-300 bg-white p-2 text-[13px] leading-relaxed"
		></textarea>
	</div>
</form>

<div class="mt-5 flex gap-2">
	<button
		onclick={() => (showModal = true)}
		class="rounded border border-gray-300 bg-gray-100 px-3 py-1 hover:bg-gray-200"
	>
		Test
	</button>
	<button
		onclick={saveConsent}
		class="rounded border border-gray-300 bg-gray-100 px-3 py-1 hover:bg-gray-200"
	>
		Save
	</button>
</div>

{#if showModal}
	<div
		class="fixed inset-0 z-[1000] flex h-full w-full items-center justify-center overflow-auto bg-black/40 pt-[100px]"
	>
		<div
			class="relative m-auto max-h-[calc(100vh-250px)] w-1/2 overflow-x-hidden overflow-y-auto border border-gray-400 bg-white p-10 shadow-lg"
		>
			<h2 class="mb-4 text-2xl font-bold">{title}</h2>
			<div class="leading-relaxed whitespace-pre-wrap">{text}</div>
			<div class="mt-8 flex gap-2">
				<button
					onclick={() => (showModal = false)}
					class="rounded border border-gray-300 bg-gray-100 px-3 py-1 hover:bg-gray-200"
				>
					Accept
				</button>
				<button
					onclick={() => (showModal = false)}
					class="rounded border border-gray-300 bg-gray-100 px-3 py-1 hover:bg-gray-200"
				>
					Decline
				</button>
			</div>
		</div>
	</div>
{/if}

{#if notification}
	<div
		class="fixed right-4 bottom-4 z-2000 rounded p-4 shadow-lg"
		class:bg-green-100={notification.type === 'success'}
		class:text-green-800={notification.type === 'success'}
		class:bg-red-100={notification.type === 'error'}
		class:text-red-800={notification.type === 'error'}
	>
		<h2 class="font-bold">{notification.type === 'success' ? 'Success' : 'Error'}</h2>
		<p>{notification.message}</p>
	</div>
{/if}
