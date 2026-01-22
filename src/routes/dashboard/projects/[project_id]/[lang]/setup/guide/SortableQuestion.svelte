<script lang="ts">
	import { useSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { slide } from 'svelte/transition';
	import type { GuideQuestion } from './types';
	import HoverInfo from '$lib/components/HoverInfo.svelte';

	interface Props {
		question: GuideQuestion;
		sectionId: string;
		sectionIndex: number;
		index: number;
		onRemove: () => void;
		isOverlay?: boolean;
	}

	let { question, sectionId, sectionIndex, index, onRemove, isOverlay = false }: Props = $props();
	let showSettings = $state(false);

	const { ref, handleRef, isDragging } = useSortable({
		id: question.id,
		index: () => index,
		group: sectionId,
		type: 'question',
		accept: 'question',
		data: {
			type: 'question',
			question,
			sectionId
		}
	});

	function handleImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			const file = input.files[0];
			const reader = new FileReader();
			reader.onload = (ev) => {
				if (!question.image) question.image = { description: '', alt: '' };
				question.image.data = ev.target?.result as string;
				question.image.name = file.name;
			};
			reader.readAsDataURL(file);
		}
	}
</script>

<div
	id={question.id}
	class="group relative scroll-mt-24 rounded-lg border border-black bg-secondary p-5 brightness-105 transition-all duration-200 hover:shadow-md"
	class:opacity-50={isDragging.current && !isOverlay}
	class:shadow-xl={isOverlay}
	class:scale-[1.02]={isOverlay}
	class:rotate-1={isOverlay}
	class:border-l-4={!isOverlay}
	class:border-l-primary={!isOverlay}
	{@attach ref}
>
	<!-- Header with Drag Handle and Actions -->
	<div class="mb-4 flex items-start justify-between">
		<div class="flex items-center gap-2">
			<span class="font-bold text-black">Question {sectionIndex + 1}.{index + 1}</span>
			<div
				class="cursor-grab rounded p-1 text-gray-800 outline-none hover:bg-white/50"
				{@attach handleRef}
			>
				<i class="fa-solid fa-grip-vertical text-lg"></i>
			</div>
		</div>

		<div class="flex gap-2">
			<button
				class="cursor-pointer rounded-md p-1.5 text-gray-700 transition-colors hover:text-primary"
				onclick={() => (showSettings = !showSettings)}
				title={showSettings ? 'Hide Settings' : 'Show Settings'}
			>
				<i class="fa-solid fa-gear" class:text-primary={showSettings}></i>
			</button>
			<button
				class="cursor-pointer rounded-md p-1.5 text-gray-700 transition-colors hover:text-red-500"
				onclick={onRemove}
				title="Remove Question"
			>
				<i class="fa-solid fa-trash"></i>
			</button>
		</div>
	</div>

	<div class="space-y-4">
		<!-- Main Content -->
		<div>
			<label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase"
				>Description</label
			>
			<textarea
				class="h-16 w-full resize-none rounded-md border-gray-200 bg-gray-50 p-3 text-sm transition-colors focus:border-primary focus:bg-white focus:ring-primary/20"
				placeholder="Add some context or description..."
				bind:value={question.description}
			></textarea>
		</div>

		<div>
			<label class="mb-1 block text-xs font-bold tracking-wider text-gray-700 uppercase"
				>Main Question</label
			>
			<textarea
				class="h-20 w-full resize-none rounded-md border-gray-200 bg-gray-50 p-3 text-sm font-medium transition-colors focus:border-primary focus:bg-white focus:ring-primary/20"
				placeholder="What would you like to ask?"
				bind:value={question.main_question}
			></textarea>
		</div>

		<!-- Visible Media/Survey Indicators (if active) -->
		{#if question.image || question.survey_item}
			<div class="flex flex-wrap gap-4 pt-2">
				{#if question.image}
					<div
						class="flex w-full items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-sm"
					>
						<div class="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-gray-200">
							{#if question.image.data}
								<img src={question.image.data} alt="Preview" class="h-full w-full object-cover" />
							{:else}
								<div class="flex h-full w-full items-center justify-center text-gray-400">
									<i class="fa-solid fa-image"></i>
								</div>
							{/if}
						</div>
						<div class="min-w-0 flex-1">
							<div class="truncate font-medium text-gray-700">
								{question.image.name || 'Image'}
							</div>
							<div class="truncate text-xs text-gray-500">
								{question.image.description || 'No description'}
							</div>
						</div>
						<button
							class="p-1 text-gray-400 hover:text-red-500"
							onclick={() => (question.image = null)}><i class="fa-solid fa-trash"></i></button
						>
					</div>
				{/if}

				{#if question.survey_item}
					<div
						class="flex w-full items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-sm"
					>
						<div
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-indigo-50 text-indigo-500"
						>
							<i class="fa-solid fa-square-poll-horizontal text-lg"></i>
						</div>
						<div class="min-w-0 flex-1">
							<div class="font-medium text-gray-700">Survey</div>
							<div class="text-xs text-gray-500">
								{question.survey_item.options.length} options ({question.survey_item.type})
							</div>
						</div>
						<button
							class="p-1 text-gray-400 hover:text-red-500"
							onclick={() => (question.survey_item = null)}
							><i class="fa-solid fa-trash"></i></button
						>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Collapsible Settings -->
		{#if showSettings}
			<div
				transition:slide={{ duration: 200 }}
				class="-mx-5 space-y-6 border-t border-gray-100 bg-gray-50/30 px-5 pt-4 pb-4"
			>
				<!-- Media Controls (Edit Mode) -->
				<div class="flex hidden gap-4">
					<div class="relative">
						{#if !question.image}
							<button
								class="flex items-center gap-2 rounded border border-gray-300 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
								onclick={() => (question.image = { description: '', alt: '' })}
							>
								<i class="fa-solid fa-image"></i> Add Image
							</button>
						{:else}
							<div
								class="w-full max-w-sm rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm"
							>
								<h4 class="mb-2 flex items-center gap-2 font-semibold text-gray-700">
									<i class="fa-solid fa-image text-primary"></i> Image Details
								</h4>
								<div class="space-y-2">
									<div class="flex gap-2">
										{#if question.image.data}
											<img
												src={question.image.data}
												alt="Preview"
												class="h-16 w-16 rounded border bg-gray-100 object-cover"
											/>
										{/if}
										<div class="flex-1 space-y-2">
											<input
												type="file"
												accept=".png,.jpg,.webp"
												class="text-xs text-gray-500 file:mr-2 file:rounded-full file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
												onchange={handleImageUpload}
											/>
											<input
												class="w-full rounded border-gray-200 p-1.5 text-xs focus:border-primary focus:ring-primary/20"
												placeholder="Description for AI..."
												bind:value={question.image.description}
											/>
										</div>
									</div>

									<input
										class="w-full rounded border-gray-200 p-1.5 text-xs focus:border-primary focus:ring-primary/20"
										placeholder="Primer text..."
										bind:value={question.image.primer}
									/>
									<input
										class="w-full rounded border-gray-200 p-1.5 text-xs focus:border-primary focus:ring-primary/20"
										placeholder="Alt text (accessibility)"
										bind:value={question.image.alt}
									/>
								</div>
							</div>
						{/if}
					</div>

					<div class="relative">
						{#if !question.survey_item}
							<button
								class="flex items-center gap-2 rounded border border-gray-300 px-2 py-1 text-sm font-medium text-gray-600 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
								onclick={() =>
									(question.survey_item = {
										type: 'radio',
										options: [{ label: 'Option 1' }]
									})}
							>
								<i class="fa-solid fa-square-poll-horizontal"></i> Add Survey
							</button>
						{:else}
							<div
								class="w-full max-w-sm rounded-md border border-gray-200 bg-white p-3 text-sm shadow-sm"
							>
								<h4 class="mb-2 flex items-center gap-2 font-semibold text-gray-700">
									<i class="fa-solid fa-square-poll-horizontal text-primary"></i> Survey Options
								</h4>
								<div class="space-y-2">
									<select
										class="w-full rounded border-gray-200 bg-gray-50 p-1.5 text-xs focus:border-primary focus:ring-primary/20"
										bind:value={question.survey_item.type}
									>
										<option value="radio">Single Choice (Radio)</option>
										<option value="checkbox">Multiple Choice (Checkbox)</option>
									</select>
									<div class="max-h-40 space-y-1 overflow-y-auto">
										{#each question.survey_item.options as option, oIdx}
											<div class="flex gap-1">
												<input
													class="flex-1 rounded border-gray-200 p-1.5 text-xs focus:border-primary focus:ring-primary/20"
													bind:value={option.label}
													placeholder={`Option ${oIdx + 1}`}
												/>
												<button
													class="px-1 text-gray-400 hover:text-red-500"
													onclick={() => question.survey_item?.options.splice(oIdx, 1)}
													><i class="fa-solid fa-trash text-xs"></i></button
												>
											</div>
										{/each}
										<button
											class="mt-1 text-xs font-medium text-primary hover:underline"
											onclick={() => question.survey_item?.options.push({ label: '' })}
											>+ Add Option</button
										>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- Alternative Main Questions -->
				<div class="hidden">
					<label class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase"
						>Alternative Phrasings</label
					>
					{#if question.alternative_main_questions}
						<div class="mb-2 space-y-2">
							{#each question.alternative_main_questions as _, aqIdx}
								<div class="flex gap-2">
									<input
										class="flex-1 rounded border-gray-200 p-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20"
										bind:value={question.alternative_main_questions[aqIdx]}
										placeholder="Another way to ask this..."
									/>
									<button
										class="px-2 text-gray-400 hover:text-red-500"
										onclick={() => question.alternative_main_questions?.splice(aqIdx, 1)}
										><i class="fa-solid fa-trash"></i></button
									>
								</div>
							{/each}
						</div>
					{/if}
					<button
						class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary/80"
						onclick={() => {
							if (!question.alternative_main_questions) question.alternative_main_questions = [];
							question.alternative_main_questions.push('');
						}}
					>
						<i class="fa-solid fa-plus"></i> Add Alternative
					</button>
				</div>

				<!-- Probes -->
				<div>
					<label class="mb-2 block text-xs font-bold tracking-wider text-gray-700 uppercase"
						>Follow-up Probes</label
					>
					{#if question.probes}
						<div class="mb-2 space-y-2">
							{#each question.probes as _, pIdx}
								<div class="flex gap-2">
									<input
										class="flex-1 rounded border-gray-200 p-2 text-sm shadow-sm focus:border-primary focus:ring-primary/20"
										bind:value={question.probes[pIdx]}
										placeholder="Follow-up question if needed..."
									/>
									<button
										class="px-2 text-gray-400 hover:text-red-500"
										onclick={() => question.probes?.splice(pIdx, 1)}
										><i class="fa-solid fa-trash"></i></button
									>
								</div>
							{/each}
						</div>
					{/if}
					<button
						class="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary/80"
						onclick={() => {
							if (!question.probes) question.probes = [];
							question.probes.push('');
						}}
					>
						<i class="fa-solid fa-plus"></i> Add Probe
					</button>
				</div>

				<!-- Configuration Grid -->
				<div class="grid grid-cols-1 gap-20 border-t border-gray-200 pt-4 sm:grid-cols-3">
					<div class="space-y-3">
						<label class="text-xs font-bold tracking-wider text-gray-700 uppercase"
							>Probing Limits</label
						>
						<div class="mt-2 space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-sm text-gray-700">Max Probes</span>
								<input
									type="number"
									min="0"
									class="w-16 rounded border-gray-200 p-1 text-sm focus:border-primary focus:ring-primary/20"
									bind:value={question.max_probes_n}
								/>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-gray-700">Time spend probing (seconds)</span>
								<input
									type="number"
									min="0"
									class="w-16 rounded border-gray-200 p-1 text-sm focus:border-primary focus:ring-primary/20"
									bind:value={question.max_probes_time}
								/>
							</div>
						</div>
					</div>

					<div class="col-span-2 space-y-3">
						<label class="text-xs font-bold tracking-wider text-gray-700 uppercase"
							>Behavior Flags</label
						>
						<div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
							<div class="flex">
								<label
									class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
								>
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary focus:ring-primary"
										bind:checked={question.exclude_from_history}
									/>
									Exclude from history
								</label>
								<HoverInfo
									class="ml-2"
									iconColor="gray-500"
									text="Excludes the question from the conversation history. This means that the AInterviewer doesn't have access to the information from this question when asking other questions."
								></HoverInfo>
							</div>
							<div class="flex">
								<label
									class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
								>
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary focus:ring-primary"
										bind:checked={question.create_segue}
									/>
									Create transition
								</label>
								<HoverInfo
									class="ml-2"
									iconColor="gray-500"
									text="Reformulates the main question to include a transition from the previous question to the current."
								></HoverInfo>
							</div>
							<div class="flex">
								<label
									class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
								>
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary focus:ring-primary"
										bind:checked={question.check_if_answered}
									/>
									Check if answered
								</label>
								<HoverInfo
									class="ml-2"
									iconColor="gray-500"
									text="Checks is the question has already been answered. If it has, the main question will be reformulated to take the previous answers into acocunt."
								></HoverInfo>
							</div>
							<div class="flex">
								<label
									class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
								>
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary focus:ring-primary"
										bind:checked={question.check_if_exhausted}
									/>
									Check if exhausted
								</label>
								<HoverInfo
									class="ml-2"
									iconColor="gray-500"
									text="Checks during probing if the question has been exhausted, based on the provided context."
								></HoverInfo>
							</div>
							<div class="flex">
								<label
									class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
								>
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary focus:ring-primary"
										bind:checked={question.can_answer}
									/>
									Can answer
								</label>
								<HoverInfo
									class="ml-2"
									iconColor="gray-500"
									text="If the user can answer; use to send multiple messages in a row while not allowing the user to answer in between."
								></HoverInfo>
							</div>
							<div class="flex">
								<label
									class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
								>
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary focus:ring-primary"
										bind:checked={question.can_skip}
									/>
									Can skip
								</label>
								<HoverInfo
									class="ml-2"
									iconColor="gray-500"
									text="If the user should be presented with a 'Skip' button when hovering the question."
								></HoverInfo>
							</div>
							<div class="flex hidden">
								<label
									class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
								>
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary focus:ring-primary"
										bind:checked={question.user_image}
									/>
									User image
								</label>
								<HoverInfo
									class="ml-2"
									iconColor="gray-500"
									text="If the user should be able to reply with an image"
								></HoverInfo>
							</div>
							<div class="flex">
								<label
									class="flex cursor-pointer items-center gap-2 text-sm text-gray-700 transition-colors hover:text-primary"
								>
									<input
										type="checkbox"
										class="rounded border-gray-300 text-primary focus:ring-primary"
										bind:checked={question.shuffle}
									/>
									Shuffle question
								</label>
								<HoverInfo
									class="ml-2"
									iconColor="gray-500"
									text="If the order of this question should be randomly shuffled. There must be multiple questions in the same section with this toggled for it to have an effect."
								></HoverInfo>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
