<!--
	The map's busy signal, along the top edge of whatever card it is dropped into.

	Indeterminate rather than a percentage: the server reports no progress, and a
	bar that pretended to know how far along it is would be making it up. Shared
	by the first load and every recompute after it, so waiting always looks the
	same whether or not there is already a map on screen.
-->
<div class="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-lg">
	<div class="sweep h-full w-1/3 bg-primary"></div>
</div>

<style>
	/* Left to right and back, so the bar never appears to restart from nothing
	   on a recompute that takes several seconds. */
	.sweep {
		animation: sweep 1.4s ease-in-out infinite alternate;
	}

	@keyframes sweep {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}

	/* A reader who has asked for less motion still has to be told the map is
	   busy; a pulse in place carries that without anything travelling. */
	@media (prefers-reduced-motion: reduce) {
		.sweep {
			width: 100%;
			animation: pulse 1.4s ease-in-out infinite alternate;
		}

		@keyframes pulse {
			from {
				opacity: 0.25;
			}
			to {
				opacity: 0.9;
			}
		}
	}
</style>
