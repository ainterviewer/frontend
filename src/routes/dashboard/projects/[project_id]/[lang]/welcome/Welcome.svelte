<script lang="ts">
	import { page } from '$app/state';
	import { Default } from '$lib/api';

	interface Props {
		initialData?: {
			title: string;
			text: string;
			email: string;
			video_file_name?: string | null;
		} | null;
	}

	let { initialData = null }: Props = $props();

	let projectId = $derived(page.params.project_id ?? '');
	let language = $derived(page.params.lang ?? '');

	// svelte-ignore state_referenced_locally
	let title = $state(initialData?.title || '');
	// svelte-ignore state_referenced_locally
	let text = $state(initialData?.text || '');
	// svelte-ignore state_referenced_locally
	let email = $state(initialData?.email || '');

	let videoFileName = $state<string | null>(initialData?.video_file_name || null);
	let videoFile = $state<File | null>(null);

	let showModal = $state(false);
	let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	let videoPreviewUrl = $state<string | null>(null);

	$effect(() => {
		let url: string | null = null;
		if (videoFile) {
			url = URL.createObjectURL(videoFile);
			videoPreviewUrl = url;
		} else if (videoFileName) {
			// FIXME: Unify shared storage location between backend and frontend
			videoPreviewUrl = `/assets/videos/${videoFileName}`;
		} else {
			videoPreviewUrl = null;
		}

		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	async function loadData() {
		if (!projectId) return;
		const { data, error } = await Default.getWelcome({
			path: { project_id: projectId, language: language }
		});
		if (data) {
			title = data.title;
			text = data.text;
			email = data.email;
			videoFileName = data.video_file_name || null;
		}
	}

	async function saveWelcome() {
		const body = {
			title,
			text,
			email,
			video: videoFile || null
		};

		const { error } = await Default.createWelcome({
			path: { project_id: projectId, language: language },
			body: body
		});

		if (!error) {
			showNotification('success', 'Welcome saved.');
			loadData();
			videoFile = null;
		} else {
			showNotification('error', 'Error when saving welcome.');
		}
	}

	function showNotification(type: 'success' | 'error', message: string) {
		notification = { type, message };
		setTimeout(() => (notification = null), 3000);
	}

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			videoFile = input.files[0];
		}
	}
</script>

<h2 class="m-0 text-xl font-bold">Welcome</h2>
<p class="my-4">
	Fill out the text you want to display to the user as a welcome message, before the interview
	starts.
</p>

<form class="flex flex-col gap-4">
	<div class="flex flex-col">
		<label for="welcome-title" class="mt-4 mb-2 block">Title</label>
		<input
			id="welcome-title"
			bind:value={title}
			placeholder="Thank you for participating!"
			class="w-full flex-1 rounded border border-gray-300 p-2"
		/>
	</div>

	<div class="flex flex-col">
		<label for="welcome-video" class="mt-4 mb-2 block">Video</label>
		<input
			id="welcome-video"
			type="file"
			accept=".mp4"
			onchange={handleFileChange}
			class="w-fit flex-1 rounded border border-gray-300 p-2"
		/>
		{#if videoFileName && !videoFile}
			<p class="mt-1 text-sm text-gray-500">Current file: {videoFileName}</p>
		{/if}
	</div>

	<div class="flex flex-col">
		<label for="welcome-text" class="mt-4 mb-2 block">Text</label>
		<textarea
			id="welcome-text"
			bind:value={text}
			placeholder="Please read the following text carefully before starting the interview."
			rows="10"
			class="min-h-60 w-full resize-y overflow-y-auto rounded border border-gray-300 bg-white p-2 text-[13px] leading-relaxed"
		></textarea>
	</div>

	<div class="flex flex-col">
		<label for="welcome-email" class="mt-4 mb-2 block">Contact email</label>
		<input
			id="welcome-email"
			bind:value={email}
			placeholder="contact@company.com"
			class="w-full flex-1 rounded border border-gray-300 p-2"
		/>
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
		onclick={saveWelcome}
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
			class="relative m-auto max-h-[calc(100vh-100px)] w-1/2 overflow-x-hidden overflow-y-auto border border-gray-400 bg-white p-10 shadow-lg"
		>
			<h2 class="mb-4 text-2xl font-bold">{title}</h2>

			{#if videoPreviewUrl}
				<div class="mb-4">
					<video controls class="max-w-full">
						<source src={videoPreviewUrl} type="video/mp4" />
						Your browser does not support the video tag.
					</video>
				</div>
			{/if}

			<div class="mb-4 leading-relaxed whitespace-pre-wrap">{text}</div>

			<hr class="my-4" />

			<div class="text-sm">
				If you wish to withdraw your consent or change your answers, please contact <a
					href={`mailto:${email}`}
					class="text-blue-600 hover:underline">{email}</a
				>
				with a reference to the following code:

				<div class="my-1.5 flex w-fit rounded border border-gray-300 bg-gray-100 p-1.5">
					<code class="mr-2 inline-block">&lt;interview-id&gt;</code>
					<i class="fa-solid fa-fingerprint self-center"></i>
				</div>
				It is your own responsibility to store this code securely before starting the interview. It is
				the only way for us to identify and modify or delete your data.
			</div>

			<div class="mt-8 flex gap-2">
				<button
					onclick={() => (showModal = false)}
					class="rounded border border-gray-300 bg-gray-100 px-3 py-1 hover:bg-gray-200"
				>
					Start
				</button>
			</div>
		</div>
	</div>
{/if}

{#if notification}
	<div
		class="fixed right-4 bottom-4 z-[2000] rounded p-4 shadow-lg"
		class:bg-green-100={notification.type === 'success'}
		class:text-green-800={notification.type === 'success'}
		class:bg-red-100={notification.type === 'error'}
		class:text-red-800={notification.type === 'error'}
	>
		<h2 class="font-bold">{notification.type === 'success' ? 'Success' : 'Error'}</h2>
		<p>{notification.message}</p>
	</div>
{/if}
