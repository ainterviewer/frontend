<script lang="ts">
	import type { EmbeddingClusterPoint } from '$lib/api/types.gen';
	import { clusterColor } from '$lib/config/chartColors';
	import { extent } from 'd3-array';
	import { scaleLinear } from 'd3-scale';

	let {
		points,
		selectedId = null,
		hoveredId = $bindable(null),
		matchedIds = null,
		onselect
	}: {
		points: EmbeddingClusterPoint[];
		selectedId?: string | null;
		hoveredId?: string | null;
		/**
		 * The ids a search matched, or `null` when no search is running. An empty
		 * set is not the same thing: it means the search ran and matched nothing
		 * on the map, and every point should say so by dimming.
		 */
		matchedIds?: Set<string> | null;
		onselect: (id: string | null) => void;
	} = $props();

	/** Inset so a point on the extreme of the projection is not half a circle. */
	const PAD = 18;
	/** How close the pointer has to get, in screen pixels, to pick a point up. */
	const HIT_RADIUS = 14;

	let width = $state(0);
	let height = $state(0);

	// Pan and zoom, applied to the plotted group rather than to the scales, so
	// the scales stay a pure function of the data and one drag does not
	// re-derive 2,000 positions.
	let zoom = $state({ k: 1, x: 0, y: 0 });
	let transformed = $derived(zoom.k !== 1 || zoom.x !== 0 || zoom.y !== 0);

	let plot = $state<HTMLDivElement | null>(null);

	// The projection is not a measurement scale — the axes are the first two
	// principal components and carry no unit — so the only thing that matters is
	// that both get the same one. A shared domain keeps the aspect ratio honest:
	// stretching each axis to fill the box would make a round cluster oval.
	let scales = $derived.by(() => {
		const [x0 = 0, x1 = 1] = extent(points, (p) => p.x);
		const [y0 = 0, y1 = 1] = extent(points, (p) => p.y);
		const span = Math.max(x1 - x0, y1 - y0) || 1;
		const cx = (x0 + x1) / 2;
		const cy = (y0 + y1) / 2;
		const box = Math.max(Math.min(width, height) - PAD * 2, 1);

		return {
			// Centred in the box on the long axis, so the cloud sits in the middle
			// of the card rather than in a corner of it.
			x: scaleLinear()
				.domain([cx - span / 2, cx + span / 2])
				.range([width / 2 - box / 2, width / 2 + box / 2]),
			// Inverted: the projection's y grows upward and the screen's downward.
			y: scaleLinear()
				.domain([cy - span / 2, cy + span / 2])
				.range([height / 2 + box / 2, height / 2 - box / 2])
		};
	});

	/** A point's position on screen, zoom included. */
	function screenX(p: EmbeddingClusterPoint) {
		return zoom.x + zoom.k * scales.x(p.x);
	}
	function screenY(p: EmbeddingClusterPoint) {
		return zoom.y + zoom.k * scales.y(p.y);
	}

	// Outliers first so they end up under the clustered points: they are the
	// most numerous and the least specific, and a grey drawn over a coloured
	// point hides the one the reader is more likely to be after.
	let ordered = $derived(
		[...points].sort((a, b) => Number(a.cluster !== null) - Number(b.cluster !== null))
	);

	function radius(p: EmbeddingClusterPoint) {
		if (p.id === selectedId) return 6;
		return p.cluster === null ? 2.5 : 3.5;
	}

	function opacity(p: EmbeddingClusterPoint) {
		// Dimmed rather than dropped while a search is up: a result you cannot
		// see in context is a list, and the map is here to give the context.
		if (matchedIds && !matchedIds.has(p.id)) return 0.1;
		if (p.cluster === null) return 0.55;
		// Membership probability, floored so a marginal member is faint but not
		// invisible — HDBSCAN's low-probability points are on cluster edges,
		// which is exactly where a reader looks when deciding if a cluster holds.
		return 0.35 + 0.6 * p.probability;
	}

	/** The point nearest a screen position, if anything is near enough. */
	function pointAt(clientX: number, clientY: number) {
		const box = plot?.getBoundingClientRect();
		if (!box) return null;
		const px = clientX - box.left;
		const py = clientY - box.top;

		let best: EmbeddingClusterPoint | null = null;
		let bestDistance = HIT_RADIUS * HIT_RADIUS;
		for (const p of points) {
			const dx = screenX(p) - px;
			const dy = screenY(p) - py;
			const distance = dx * dx + dy * dy;
			if (distance <= bestDistance) {
				best = p;
				bestDistance = distance;
			}
		}
		return best;
	}

	// Dragging is tracked rather than inferred from the button being down: a
	// pointerup that ends a pan must not also count as a click on whatever point
	// happens to be under the cursor when the drag stops.
	let dragging = $state(false);
	let dragged = false;
	let dragOrigin = { x: 0, y: 0 };

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		dragging = true;
		dragged = false;
		dragOrigin = { x: event.clientX - zoom.x, y: event.clientY - zoom.y };
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function onpointermove(event: PointerEvent) {
		if (dragging) {
			const x = event.clientX - dragOrigin.x;
			const y = event.clientY - dragOrigin.y;
			// A few pixels of slop, so a click with an unsteady hand still selects.
			if (Math.abs(x - zoom.x) > 2 || Math.abs(y - zoom.y) > 2) dragged = true;
			zoom = { ...zoom, x, y };
			return;
		}
		hoveredId = pointAt(event.clientX, event.clientY)?.id ?? null;
	}

	function onpointerup(event: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		if (dragged) return;
		// Clicking the background clears the selection, which is the only way
		// back to the cluster overview without reaching for the panel.
		onselect(pointAt(event.clientX, event.clientY)?.id ?? null);
	}

	function onwheel(event: WheelEvent) {
		event.preventDefault();
		const box = plot?.getBoundingClientRect();
		if (!box) return;

		const px = event.clientX - box.left;
		const py = event.clientY - box.top;
		const k = Math.min(12, Math.max(1, zoom.k * Math.exp(-event.deltaY * 0.002)));
		// Hold the point under the cursor still: the reader is pointing at
		// something, and zooming it out from under them loses the thing they were
		// zooming in on.
		zoom = {
			k,
			x: px - (px - zoom.x) * (k / zoom.k),
			y: py - (py - zoom.y) * (k / zoom.k)
		};
	}

	function reset() {
		zoom = { k: 1, x: 0, y: 0 };
	}

	// The keyboard path over the map. The panel beside it — cluster list, search
	// results, representatives — is the better one for a screen reader, but a
	// surface whose only affordance is a mouse is not finished, and stepping
	// through the points in plotted order at least makes every one reachable.
	function onkeydown(event: KeyboardEvent) {
		if (points.length === 0) return;

		if (event.key === 'Escape') {
			onselect(null);
			hoveredId = null;
			return;
		}

		const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (step !== 0) {
			event.preventDefault();
			const current = ordered.findIndex((p) => p.id === (hoveredId ?? selectedId));
			const next = (current + step + ordered.length) % ordered.length;
			hoveredId = ordered[next].id;
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (hoveredId) onselect(hoveredId);
		}
	}

	let hovered = $derived(points.find((p) => p.id === hoveredId) ?? null);
</script>

<div class="relative h-full w-full rounded-lg bg-white">
	<div bind:this={plot} bind:clientWidth={width} bind:clientHeight={height} class="h-full w-full">
		{#if width > 0 && height > 0}
			<svg {width} {height} class="pointer-events-none block" aria-hidden="true">
				<g transform="translate({zoom.x},{zoom.y}) scale({zoom.k})">
					{#each ordered as point (point.id)}
						<circle
							cx={scales.x(point.x)}
							cy={scales.y(point.y)}
							r={radius(point) / zoom.k}
							fill={clusterColor(point.cluster)}
							opacity={opacity(point)}
						/>
					{/each}

					<!-- Rings last, so the one point the reader is acting on is never
					     under another. Both are unfilled: the fill underneath is the
					     cluster colour, which is the thing being pointed at. -->
					{#each ordered as point (point.id)}
						{#if point.id === selectedId || point.id === hoveredId}
							<circle
								cx={scales.x(point.x)}
								cy={scales.y(point.y)}
								r={(point.id === selectedId ? 9 : 7) / zoom.k}
								fill="none"
								stroke={clusterColor(point.cluster)}
								stroke-width={(point.id === selectedId ? 2 : 1.5) / zoom.k}
							/>
						{/if}
					{/each}
				</g>
			</svg>
		{/if}

		<!-- The interaction layer is a button rather than a div carrying handlers:
		     it is genuinely one control — "open a chunk" — and being one gets it
		     focus, an accessible name and keyboard events without arguing with
		     them. The points beneath are drawn, not interactive; the panel beside
		     the map is where they are reachable one at a time. -->
		<button
			type="button"
			aria-label="Cluster map, {points.length} chunks. Left and right arrows step through them, Enter opens one."
			class="absolute inset-0 touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
			class:cursor-grabbing={dragging}
			class:cursor-crosshair={!dragging}
			{onpointerdown}
			{onpointermove}
			{onpointerup}
			{onwheel}
			{onkeydown}
		></button>
	</div>

	{#if hovered}
		<!-- Follows the point rather than the cursor, so it stops moving once the
		     reader has landed on something and can be read. -->
		<div
			class="pointer-events-none absolute z-10 max-w-xs -translate-x-1/2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-lg"
			style="left:{Math.min(Math.max(screenX(hovered), 90), width - 90)}px;top:{screenY(hovered) +
				14}px"
		>
			<span class="line-clamp-4">{hovered.preview ?? 'No preview'}</span>
			<span class="mt-1 block text-[0.6875rem] text-gray-400">
				{hovered.cluster === null
					? 'Unplaced'
					: `Cluster ${hovered.cluster} · ${Math.round(hovered.probability * 100)}% member`}
			</span>
		</div>
	{/if}

	{#if transformed}
		<button
			type="button"
			onclick={reset}
			class="absolute top-2 right-2 rounded-md border border-gray-200 bg-white/90 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:text-gray-900"
		>
			Reset view
		</button>
	{/if}
</div>
