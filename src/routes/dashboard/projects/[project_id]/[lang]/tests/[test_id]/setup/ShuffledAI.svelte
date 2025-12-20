<script lang="ts">
	import { Default, type TestSetupPublic } from '$lib/api';

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
		try {
			// Filter out empty strings/pairs
			const cleanList = (list: string[]) => list.filter((item) => item && item.trim() !== '');
			const cleanPairs = (list: [string, string][]) =>
				list.filter((pair) => pair[0] && pair[0].trim() !== ''); // Check name at least

			await Default.updateBackgroundInfo({
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
			alert('Background information saved.');
		} catch (e) {
			console.error(e);
			alert('Failed to save setup.');
		} finally {
			isSaving = false;
		}
	}
</script>

<div style="width: 80%; max-width: 1000px">
	<h2 class="underline-simple">Setup</h2>
	<h3>Background Information</h3>
	<p>
		Define the background characteristics of the synthetic interviewees. These will be randomly
		mixed for each synthetic interviewee.
	</p>

	<!-- Names and Gender -->
	<div class="section">
		<h4>Names and Gender</h4>
		{#each names_gender as pair, i}
			<div class="row">
				<input type="text" placeholder="Name" bind:value={pair[0]} />
				<input type="text" placeholder="Gender" bind:value={pair[1]} />
				<button class="remove-btn" onclick={() => removeNameGender(i)}>
					<span class="minus-icon">×</span>
				</button>
			</div>
		{/each}
		<button class="add-btn" onclick={addNameGender}>
			<span class="plus-icon">+</span>Add Name/Gender Pair
		</button>
	</div>

	<!-- Age Range -->
	<div class="section">
		<h4>Age Range</h4>
		<div class="row">
			<input type="number" min="18" max="100" bind:value={age_range[0]} />
			<span>to</span>
			<input type="number" min="18" max="100" bind:value={age_range[1]} />
		</div>
	</div>

	<!-- Generic String Lists -->
	{#each [{ title: 'Education', list: educations }, { title: 'Occupations', list: occupations }, { title: 'Locations', list: locations }, { title: 'Personalities', list: personalities }] as group}
		<div class="section">
			<h4>{group.title}</h4>
			{#each group.list as item, i}
				<div class="row">
					<input type="text" placeholder={group.title} bind:value={group.list[i]} />
					<button class="remove-btn" onclick={() => removeRow(group.list, i)}>
						<span class="minus-icon">×</span>
					</button>
				</div>
			{/each}
			<button class="add-btn" onclick={() => addRow(group.list)}>
				<span class="plus-icon">+</span>Add {group.title}
			</button>
		</div>
	{/each}

	<!-- Communication Traits -->
	<div class="section communication-traits">
		<h4>Communication Traits</h4>

		<div class="subsection">
			<h5>Length</h5>
			{#each comm_length as item, i}
				<div class="row">
					<input type="text" placeholder="Length" bind:value={comm_length[i]} />
					<button class="remove-btn" onclick={() => removeRow(comm_length, i)}>
						<span class="minus-icon">×</span>
					</button>
				</div>
			{/each}
			<button class="add-btn" onclick={() => addRow(comm_length)}>
				<span class="plus-icon">+</span>Add Length
			</button>
		</div>

		<div class="subsection">
			<h5>Style</h5>
			{#each comm_style as item, i}
				<div class="row">
					<input type="text" placeholder="Style" bind:value={comm_style[i]} />
					<button class="remove-btn" onclick={() => removeRow(comm_style, i)}>
						<span class="minus-icon">×</span>
					</button>
				</div>
			{/each}
			<button class="add-btn" onclick={() => addRow(comm_style)}>
				<span class="plus-icon">+</span>Add Style
			</button>
		</div>

		<div class="subsection">
			<h5>Tone</h5>
			{#each comm_tone as item, i}
				<div class="row">
					<input type="text" placeholder="Tone" bind:value={comm_tone[i]} />
					<button class="remove-btn" onclick={() => removeRow(comm_tone, i)}>
						<span class="minus-icon">×</span>
					</button>
				</div>
			{/each}
			<button class="add-btn" onclick={() => addRow(comm_tone)}>
				<span class="plus-icon">+</span>Add Tone
			</button>
		</div>
	</div>

	<!-- Extra Traits -->
	<div class="section">
		<h4>Extra traits</h4>
		{#each extra_traits as item, i}
			<div class="row">
				<input type="text" placeholder="Trait" bind:value={extra_traits[i]} />
				<button class="remove-btn" onclick={() => removeRow(extra_traits, i)}>
					<span class="minus-icon">×</span>
				</button>
			</div>
		{/each}
		<button class="add-btn" onclick={() => addRow(extra_traits)}>
			<span class="plus-icon">+</span>Add Trait
		</button>
	</div>

	<!-- Refusal Rate -->
	<div class="section">
		<h4>Refusal Rate (%)</h4>
		<p>The chance that the subject will be explicitly told to refuse answering a given question.</p>
		<div class="row">
			<label>Min:</label>
			<input type="number" min="0" max="100" bind:value={refusal_rate[0]} />
			<label>Max:</label>
			<input type="number" min="0" max="100" bind:value={refusal_rate[1]} />
		</div>
	</div>

	<br /><br />
	<button onclick={saveSetup} disabled={isSaving} class="save-btn">
		{isSaving ? 'Saving...' : 'Save'}
	</button>
	<!-- Export button not implemented yet as per request scope but present in HTML -->
</div>

<style>
	.section {
		margin-bottom: 24px;
	}

	.communication-traits {
		border: 1px solid #eee;
		padding: 16px;
		border-radius: 8px;
		background-color: #fafafa;
	}

	.row {
		display: flex;
		gap: 10px;
		margin-bottom: 10px;
		align-items: center;
	}

	input {
		padding: 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		flex: 1;
	}

	input[type='number'] {
		width: 70px;
		flex: initial;
	}

	button {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.save-btn {
		background-color: #0066cc;
		color: white;
		font-weight: bold;
	}

	.add-btn {
		background-color: #e6f3ff;
		color: #0066cc;
	}

	.remove-btn {
		background-color: #ffe6e6;
		color: #cc0000;
		padding: 8px;
	}

	h3 {
		color: #333;
		margin-bottom: 20px;
	}

	h4 {
		color: #666;
		margin-bottom: 10px;
	}

	h5 {
		margin-top: 10px;
		margin-bottom: 5px;
		font-weight: bold;
	}

	.plus-icon {
		font-size: 18px;
		font-weight: bold;
	}

	.minus-icon {
		font-size: 18px;
		font-weight: bold;
	}

	.underline-simple {
		border-bottom: 2px solid #eee;
		padding-bottom: 10px;
		margin-bottom: 20px;
	}
</style>
