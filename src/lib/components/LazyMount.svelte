<script lang="ts" module>
	// Charts are expensive to instantiate, and what actually blocks the main
	// thread is mounting several of them in the same frame. Instances queue here
	// rather than mounting themselves, and are let through one at a time.
	//
	// The queue drains on its own rather than waiting to be scrolled to: gating
	// each mount on its own visibility puts every mount in a frame the browser
	// is already using to scroll, which is the one moment it can least afford
	// the work. Coming into view is a priority hint, not the trigger.
	//
	// The queue is module-level on purpose: the budget being shared out is the
	// main thread, so it has to be shared across every instance on the page.

	/** How long a page that never goes idle may hold a reached instance up. */
	const IDLE_TIMEOUT = 500;
	/** How long after the last scroll event the page counts as still. */
	const SCROLL_QUIET_MS = 150;
	/** How long after the last instance registers prefetching may begin. */
	const PREFETCH_DELAY = 800;
	/** Idle left in the frame before a prefetched mount is worth starting. */
	const MIN_IDLE_MS = 12;
	/** How long to leave a frame alone after finding it too busy to mount in. */
	const BUSY_BACKOFF = 200;
	/**
	 * Instances past this many are left to mount when they are scrolled to. A
	 * report can hold hundreds of cards, and mounting the tail of one nobody
	 * scrolls to costs more than the head it would have saved.
	 */
	const PREFETCH_LIMIT = 40;

	type Mount = () => void;
	type Priority = 'urgent' | 'pending';

	const hasIdleCallback = typeof requestIdleCallback === 'function';

	// What the user has reached has to appear even on a page that never goes
	// idle, so it is scheduled with a timeout. Prefetching has nowhere to be and
	// is scheduled without one, which keeps it out of the way of the load it
	// would otherwise compete with. Each returns its own canceller, because an
	// urgent mount arriving behind a scheduled prefetch has to replace it --
	// otherwise it inherits the prefetch's lack of a timeout.
	const schedule: Record<Priority, (cb: (deadline?: IdleDeadline) => void) => () => void> = {
		urgent: hasIdleCallback
			? (cb) => {
					const id = requestIdleCallback(cb, { timeout: IDLE_TIMEOUT });
					return () => cancelIdleCallback(id);
				}
			: (cb) => {
					const id = requestAnimationFrame(() => cb());
					return () => cancelAnimationFrame(id);
				},
		pending: hasIdleCallback
			? (cb) => {
					const id = requestIdleCallback(cb);
					return () => cancelIdleCallback(id);
				}
			: (cb) => {
					const id = setTimeout(() => cb(), 100);
					return () => clearTimeout(id);
				}
	};

	/** Reached by the user, so worth mounting before anything further down. */
	const urgent: Mount[] = [];
	const pending: Mount[] = [];
	let scheduled: { priority: Priority; cancel: () => void } | null = null;

	let scrolling = false;
	let scrollTimer: ReturnType<typeof setTimeout> | undefined;
	let watchingScroll = false;

	// Instances register while the page is still assembling itself, and mounting
	// into that is the load cost this component exists to avoid, so prefetching
	// holds off until registrations have stopped coming in.
	let prefetching = false;
	let prefetchTimer: ReturnType<typeof setTimeout> | undefined;

	let backoffTimer: ReturnType<typeof setTimeout> | undefined;

	// A frame too busy to mount in is usually followed by another, and an idle
	// callback whose only act is to book the next one is work of its own. So a
	// prefetch that finds no room waits a little before asking again rather
	// than re-arming immediately. Urgent mounts do not come through here; they
	// keep their own timeout and are scheduled the moment one is queued.
	function backOff() {
		if (backoffTimer !== undefined) return;
		backoffTimer = setTimeout(() => {
			backoffTimer = undefined;
			kick();
		}, BUSY_BACKOFF);
	}

	function watchScrolling() {
		if (watchingScroll) return;
		watchingScroll = true;
		// Capturing, because scroll events do not bubble and the scrolling
		// element is not necessarily the document -- the dashboard scrolls
		// inside its own <main>.
		window.addEventListener(
			'scroll',
			() => {
				scrolling = true;
				clearTimeout(scrollTimer);
				scrollTimer = setTimeout(() => {
					scrolling = false;
					kick();
				}, SCROLL_QUIET_MS);
			},
			{ capture: true, passive: true }
		);
	}

	function armPrefetch() {
		prefetching = false;
		clearTimeout(prefetchTimer);
		prefetchTimer = setTimeout(() => {
			prefetching = true;
			kick();
		}, PREFETCH_DELAY);
	}

	function kick() {
		const priority: Priority | null =
			urgent.length > 0 ? 'urgent' : pending.length > 0 && prefetching ? 'pending' : null;
		if (!priority) return;

		if (scheduled) {
			// Anything already scheduled will pick the urgent queue up first, so
			// the only case worth rescheduling is an urgent mount stuck behind a
			// prefetch callback that may never come.
			if (scheduled.priority === priority || priority === 'pending') return;
			scheduled.cancel();
		}
		scheduled = { priority, cancel: schedule[priority](drain) };
	}

	function drain(deadline?: IdleDeadline) {
		scheduled = null;

		// Nothing is mounted under an active scroll; whatever has not been
		// reached keeps its placeholder until the page is still again, which is
		// what the placeholder is for. The scroll timer picks the queue back up.
		if (scrolling) return;

		const reached = urgent.shift();
		if (reached) {
			reached();
			kick();
			return;
		}

		if (!prefetching) return;

		// Only spend idle the browser actually has: a short budget means the
		// frame is busy, so wait for a quieter one.
		if (deadline && !deadline.didTimeout && deadline.timeRemaining() < MIN_IDLE_MS) {
			backOff();
			return;
		}

		pending.shift()?.();
		kick();
	}

	function enqueue(mount: Mount, priority: Priority) {
		watchScrolling();
		if (priority === 'urgent') {
			urgent.push(mount);
		} else {
			if (pending.length >= PREFETCH_LIMIT) return;
			pending.push(mount);
			armPrefetch();
		}
		kick();
	}

	/** Navigating away must not mount into components that are already gone. */
	function dequeue(mount: Mount) {
		for (const queue of [urgent, pending]) {
			const index = queue.indexOf(mount);
			if (index !== -1) queue.splice(index, 1);
		}
	}

	// The window viewport is the wrong yardstick for "can the user see this"
	// when the page scrolls inside its own element. Cached because the answer is
	// usually the same for every instance under the same scroll container.
	let scrollRoot: Element | null = null;

	// Walks up to the nearest scrolling ancestor, stopping early if it reaches
	// the cached one. Deliberately not `scrollRoot.contains(node)`: an outer
	// scroller contains everything a nested one does, so `contains` alone would
	// measure an instance inside an inner list against the outer container and
	// call it on screen. Reaching the cache on the way up proves nothing
	// nearer scrolls, and still saves the `getComputedStyle` calls above it --
	// which are the expensive part of the walk.
	function findScrollRoot(node: Element) {
		for (let el = node.parentElement; el; el = el.parentElement) {
			if (el === scrollRoot) return el;
			const { overflowY } = getComputedStyle(el);
			if (overflowY === 'auto' || overflowY === 'scroll') return el;
		}
		return null;
	}

	// Checked here rather than left to CSS: what `animate` mostly turns on is
	// the chart libraries' own JS motion, which no media query reaches. Read at
	// mount rather than cached, so the preference can change mid-session.
	function prefersReducedMotion() {
		return (
			typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	function viewportBounds(node: Element) {
		if (!scrollRoot?.isConnected) scrollRoot = null;
		scrollRoot = findScrollRoot(node);

		if (!scrollRoot) return { top: 0, bottom: document.documentElement.clientHeight };
		const rect = scrollRoot.getBoundingClientRect();
		return { top: rect.top, bottom: rect.bottom };
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		placeholder,
		rootMargin = '600px',
		class: className = ''
	}: {
		/**
		 * Receives whether the content was on screen when this instance first
		 * appeared. Content that scrolls into view later should mount without an
		 * entry animation: the animation competes with the scroll for the same
		 * frames, and would have mostly played out by the time it is seen.
		 * Always `false` for a reader who prefers reduced motion.
		 */
		children: Snippet<[animate: boolean]>;
		/** Drawn until `children` is mounted. */
		placeholder?: Snippet;
		/** How far ahead of the viewport to promote this instance in the queue. */
		rootMargin?: string;
		/**
		 * Put the height the mounted content will take here rather than on the
		 * content itself: an unmounted region that collapses to nothing sits in
		 * the viewport no matter how far down the page it belongs, which would
		 * mount every instance at once and defeat the whole arrangement.
		 */
		class?: string;
	} = $props();

	let mounted = $state(false);
	let animate = $state(false);

	function whenVisible(node: HTMLElement) {
		if (mounted) return;

		// Both queues hold this same closure; whichever comes up first wins and
		// drops the twin, so it does not go on occupying a turn.
		let animateOnMount = false;
		const mount = () => {
			if (mounted) return;
			dequeue(mount);
			animate = animateOnMount && !prefersReducedMotion();
			mounted = true;
		};

		// Nothing to defer against without an observer, so mount rather than
		// leaving the placeholder up forever.
		if (typeof IntersectionObserver === 'undefined') {
			animateOnMount = true;
			mount();
			return;
		}

		// The observer's first callback describes where this instance started
		// out; anything after it is the result of scrolling.
		let initial = true;

		const observer = new IntersectionObserver(
			(entries) => {
				const wasInitial = initial;
				initial = false;

				if (mounted) {
					observer.disconnect();
					return;
				}
				if (!entries.some((entry) => entry.isIntersecting)) return;
				observer.disconnect();

				// `rootMargin` deliberately reports a hit before the content is on
				// screen, so the intersection alone does not say whether the user
				// can see it; the unexpanded rect does. Read here rather than when
				// the queue drains, so a slow queue cannot turn a scrolled-to
				// instance into an animated one.
				const rect = node.getBoundingClientRect();
				const view = viewportBounds(node);
				animateOnMount = wasInitial && rect.top < view.bottom && rect.bottom > view.top;

				enqueue(mount, 'urgent');
			},
			{ rootMargin }
		);
		observer.observe(node);

		// Queued straight away as well, behind everything the user has actually
		// reached. Content mounted this way is by definition not on screen yet,
		// so it never animates.
		enqueue(mount, 'pending');

		return () => {
			dequeue(mount);
			observer.disconnect();
		};
	}
</script>

<div {@attach whenVisible} class={className}>
	{#if mounted}
		{@render children(animate)}
	{:else}
		{@render placeholder?.()}
	{/if}
</div>
