<script lang="ts">
	import { page } from '$app/state';

	let projectId = $derived(page.params.project_id);
	let interviewURL = $state('');
	let copied = $state(false);

	$effect(() => {
		if (typeof window !== 'undefined' && projectId) {
			interviewURL = window.location.origin + '/interview?id=' + projectId;
		}
	});

	function copyLink() {
		if (!interviewURL) return;

		const success = () => {
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 700);
		};

		if (navigator.clipboard) {
			navigator.clipboard
				.writeText(interviewURL)
				.then(success)
				.catch((err) => {
					console.error('Failed to copy: ', err);
					fallbackCopy();
				});
		} else {
			fallbackCopy();
		}

		function fallbackCopy() {
			try {
				const el = document.createElement('textarea');
				el.value = interviewURL;
				document.body.appendChild(el);
				el.select();
				document.execCommand('copy');
				document.body.removeChild(el);
				success();
			} catch (e) {
				console.error('Fallback copy failed', e);
			}
		}
	}
</script>

<div class="w-[80%] max-w-[1000px]">
	<h1 class="page-title">Distribution</h1>
	<p class="mb-4 text-gray-600">
		Distribute your interview either via clicking the button below, or by copying the QR-code. Both
		sends the user to your interview.
	</p>
	<div>
		<div class="flex items-center">
			<label for="interview-distribution-container" class="mr-2">Copy link:</label>
			<div class="relative w-fit">
				<button
					id="interview-distribution-container"
					onclick={copyLink}
					class="flex w-fit cursor-pointer items-center transition-transform active:scale-105"
					title="Copy link"
					type="button"
					disabled={page.data.user?.scope === 'demo'}
				>
					<span
						class="mr-2 inline-block rounded-[5px] border border-[#e0e0e0] bg-[#f5f5f5] px-[7px] py-[5px]"
					>
						{projectId}
					</span>
					<i class="fa-regular fa-clipboard"></i>
				</button>

				{#if copied}
					<div
						class="absolute top-1/2 left-full z-10 ml-2 -translate-y-1/2 rounded bg-black px-2 py-1 text-xs whitespace-nowrap text-white opacity-90 shadow-lg transition-opacity duration-300"
					>
						Copied
					</div>
				{/if}
			</div>
		</div>
		<div id="qrcode" class="mt-5 block h-[280px] w-[280px]">
			<img src={`/api/projects/${projectId}/qr.png`} alt="QR Code" class="h-[280px] w-[280px]" />
		</div>
	</div>
</div>
