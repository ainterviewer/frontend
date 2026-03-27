<script lang="ts">
	import { Synthesize, type TestSetupPublic } from '$lib/api';
	import { toast } from 'svelte-sonner';

	let { test }: { test: TestSetupPublic } = $props();

	// Initialize state from test.background_info or defaults
	let names_gender = $state(
		test.background_info?.names_gender?.length ? test.background_info.names_gender : [['', '']]
	);
	let age_range = $state(test.background_info?.age_range || [18, 80]);
	let educations = $state(
		test.background_info?.educations?.length ? test.background_info.educations : ['']
	);
	let occupations = $state(
		test.background_info?.occupations?.length ? test.background_info.occupations : ['']
	);
	let locations = $state(
		test.background_info?.locations?.length ? test.background_info.locations : ['']
	);
	let personalities = $state(
		test.background_info?.personalities?.length ? test.background_info.personalities : ['']
	);

	// Communication traits
	let comm_length = $state(
		test.background_info?.communication_traits?.length?.length
			? test.background_info.communication_traits.length
			: ['']
	);
	let comm_style = $state(
		test.background_info?.communication_traits?.style?.length
			? test.background_info.communication_traits.style
			: ['']
	);
	let comm_tone = $state(
		test.background_info?.communication_traits?.tone?.length
			? test.background_info.communication_traits.tone
			: ['']
	);

	// Extra traits (assuming string[] based on HTML template)
	let extra_traits = $state(
		(test.background_info?.extra_traits as string[])?.length
			? (test.background_info?.extra_traits as string[])
			: ['']
	);

	let refusal_rate = $state(
		test.background_info?.refusal_rate
			? [test.background_info.refusal_rate[0] * 100, test.background_info.refusal_rate[1] * 100]
			: [0, 0]
	);

	let isSaving = $state(false);

	function addRow(list: any[], defaultVal: any = '') {
		list.push(defaultVal);
	}

	function removeRow(list: any[], index: number) {
		if (list.length > 1) {
			list.splice(index, 1);
		}
	}

	function addNameGender() {
		names_gender.push(['', '']);
	}

	function removeNameGender(index: number) {
		if (names_gender.length > 1) {
			names_gender.splice(index, 1);
		}
	}

	async function saveSetup() {
		isSaving = true;
		// Filter out empty strings/pairs
		const cleanList = (list: string[]) => list.filter((item) => item && item.trim() !== '');
		const cleanPairs = (list: [string, string][]) =>
			list.filter((pair) => pair[0] && pair[0].trim() !== ''); // Check name at least

		const { error } = await Synthesize.updateBackgroundInfo({
			path: {
				project_id: test.project_id,
				test_id: test.id
			},
			body: {
				background_info: {
					names_gender: cleanPairs($state.snapshot(names_gender)),
					age_range: $state.snapshot(age_range) as [number, number],
					educations: cleanList($state.snapshot(educations)),
					occupations: cleanList($state.snapshot(occupations)),
					locations: cleanList($state.snapshot(locations)),
					personalities: cleanList($state.snapshot(personalities)),
					communication_traits: {
						length: cleanList($state.snapshot(comm_length)) as any[],
						style: cleanList($state.snapshot(comm_style)),
						tone: cleanList($state.snapshot(comm_tone))
					},
					extra_traits: cleanList($state.snapshot(extra_traits)),
					refusal_rate: [refusal_rate[0] / 100, refusal_rate[1] / 100]
				}
			}
		});
		isSaving = false;
		if (error) {
			console.error(error);
			toast.error('Failed to save setup');
			return;
		}
		toast.success('Background information saved');
	}
</script>

<h2 class="page-title">Setup - Shuffled AI Respondents</h2>
<p class="text-gray-600">
	Define the background characteristics of the synthetic interviewees. These will be randomly mixed
	for each synthetic interviewee.
</p>

<!-- Names and Gender -->
<div class="my-6">
	<h4 class="mb-2.5 font-bold text-gray-600">Names and Gender</h4>
	{#each names_gender as pair, i}
		<div class="mb-2.5 flex items-center gap-2.5">
			<input
				type="text"
				placeholder="Name"
				bind:value={pair[0]}
				class="flex-1 rounded border border-gray-300 p-2"
			/>
			<input
				type="text"
				placeholder="Gender"
				bind:value={pair[1]}
				class="flex-1 rounded border border-gray-300 p-2"
			/>
			<button
				class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-red-50 p-2 text-red-700"
				onclick={() => removeNameGender(i)}
			>
				<span class="text-lg font-bold">×</span>
			</button>
		</div>
	{/each}
	<button
		class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-blue-50 px-4 py-2 text-blue-700"
		onclick={addNameGender}
	>
		<span class="text-lg font-bold">+</span>Add Name/Gender Pair
	</button>
</div>

<!-- Age Range -->
<div class="mb-6">
	<h4 class="mb-2.5 font-bold text-gray-600">Age Range</h4>
	<div class="mb-2.5 flex items-center gap-2.5">
		<input
			type="number"
			min="18"
			max="100"
			bind:value={age_range[0]}
			class="w-[70px] flex-none rounded border border-gray-300 p-2"
		/>
		<span>to</span>
		<input
			type="number"
			min="18"
			max="100"
			bind:value={age_range[1]}
			class="w-[70px] flex-none rounded border border-gray-300 p-2"
		/>
	</div>
</div>

<!-- Generic String Lists -->
{#each [{ title: 'Education', list: educations }, { title: 'Occupations', list: occupations }, { title: 'Locations', list: locations }, { title: 'Personalities', list: personalities }] as group}
	<div class="mb-6">
		<h4 class="mb-2.5 font-bold text-gray-600">{group.title}</h4>
		{#each group.list as item, i}
			<div class="mb-2.5 flex items-center gap-2.5">
				<input
					type="text"
					placeholder={group.title}
					bind:value={group.list[i]}
					class="flex-1 rounded border border-gray-300 p-2"
				/>
				<button
					class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-red-50 p-2 text-red-700"
					onclick={() => removeRow(group.list, i)}
				>
					<span class="text-lg font-bold">×</span>
				</button>
			</div>
		{/each}
		<button
			class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-blue-50 px-4 py-2 text-blue-700"
			onclick={() => addRow(group.list)}
		>
			<span class="text-lg font-bold">+</span>Add {group.title}
		</button>
	</div>
{/each}

<!-- Communication Traits -->
<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
	<h4 class="mb-2.5 font-bold text-gray-600">Communication Traits</h4>

	<div>
		<h5 class="mt-2.5 mb-1.5 font-bold">Length</h5>
		{#each comm_length as item, i}
			<div class="mb-2.5 flex items-center gap-2.5">
				<input
					type="text"
					placeholder="Length"
					bind:value={comm_length[i]}
					class="flex-1 rounded border border-gray-300 p-2"
				/>
				<button
					class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-red-50 p-2 text-red-700"
					onclick={() => removeRow(comm_length, i)}
				>
					<span class="text-lg font-bold">×</span>
				</button>
			</div>
		{/each}
		<button
			class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-blue-50 px-4 py-2 text-blue-700"
			onclick={() => addRow(comm_length)}
		>
			<span class="text-lg font-bold">+</span>Add Length
		</button>
	</div>

	<div>
		<h5 class="mt-2.5 mb-1.5 font-bold">Style</h5>
		{#each comm_style as item, i}
			<div class="mb-2.5 flex items-center gap-2.5">
				<input
					type="text"
					placeholder="Style"
					bind:value={comm_style[i]}
					class="flex-1 rounded border border-gray-300 p-2"
				/>
				<button
					class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-red-50 p-2 text-red-700"
					onclick={() => removeRow(comm_style, i)}
				>
					<span class="text-lg font-bold">×</span>
				</button>
			</div>
		{/each}
		<button
			class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-blue-50 px-4 py-2 text-blue-700"
			onclick={() => addRow(comm_style)}
		>
			<span class="text-lg font-bold">+</span>Add Style
		</button>
	</div>

	<div>
		<h5 class="mt-2.5 mb-1.5 font-bold">Tone</h5>
		{#each comm_tone as item, i}
			<div class="mb-2.5 flex items-center gap-2.5">
				<input
					type="text"
					placeholder="Tone"
					bind:value={comm_tone[i]}
					class="flex-1 rounded border border-gray-300 p-2"
				/>
				<button
					class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-red-50 p-2 text-red-700"
					onclick={() => removeRow(comm_tone, i)}
				>
					<span class="text-lg font-bold">×</span>
				</button>
			</div>
		{/each}
		<button
			class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-blue-50 px-4 py-2 text-blue-700"
			onclick={() => addRow(comm_tone)}
		>
			<span class="text-lg font-bold">+</span>Add Tone
		</button>
	</div>
</div>

<!-- Extra Traits -->
<div class="mb-6">
	<h4 class="mb-2.5 font-bold text-gray-600">Extra traits</h4>
	{#each extra_traits as item, i}
		<div class="mb-2.5 flex items-center gap-2.5">
			<input
				type="text"
				placeholder="Trait"
				bind:value={extra_traits[i]}
				class="flex-1 rounded border border-gray-300 p-2"
			/>
			<button
				class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-red-50 p-2 text-red-700"
				onclick={() => removeRow(extra_traits, i)}
			>
				<span class="text-lg font-bold">×</span>
			</button>
		</div>
	{/each}
	<button
		class="flex cursor-pointer items-center gap-1.5 rounded border-none bg-blue-50 px-4 py-2 text-blue-700"
		onclick={() => addRow(extra_traits)}
	>
		<span class="text-lg font-bold">+</span>Add Trait
	</button>
</div>

<!-- Refusal Rate -->
<div class="mb-6">
	<h4 class="mb-2.5 font-bold text-gray-600">Refusal Rate (%)</h4>
	<p>The chance that the subject will be explicitly told to refuse answering a given question.</p>
	<div class="mb-2.5 flex items-center gap-2.5">
		<label>Min:</label>
		<input
			type="number"
			min="0"
			max="100"
			bind:value={refusal_rate[0]}
			class="w-[70px] flex-none rounded border border-gray-300 p-2"
		/>
		<label>Max:</label>
		<input
			type="number"
			min="0"
			max="100"
			bind:value={refusal_rate[1]}
			class="w-[70px] flex-none rounded border border-gray-300 p-2"
		/>
	</div>
</div>

<div
	class="sticky bottom-0 ml-auto flex w-fit gap-4 rounded-full border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur"
>
	<button
		onclick={saveSetup}
		disabled={isSaving}
		class="flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-medium text-white shadow-sm hover:bg-dark disabled:cursor-not-allowed disabled:opacity-50"
	>
		{#if isSaving}
			<i class="fas fa-spinner fa-spin"></i> Saving...
		{:else}
			<i class="fa-solid fa-floppy-disk"></i> Save Setup
		{/if}
	</button>
</div>

<!-- Export button not implemented yet as per request scope but present in HTML -->
