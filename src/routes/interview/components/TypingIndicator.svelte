<script>
	// We can use a local style block for the specific keyframes
</script>

<div class="mt-4.5 flex h-5 w-full justify-start px-[10px] sm:px-[50px]">
	<div class="flex items-center">
		<div class="typing-dot mx-[3px] h-[6px] w-[6px] rounded-full bg-[#4b4f58] opacity-40"></div>
		<div
			class="typing-dot mx-[3px] h-[6px] w-[6px] rounded-full bg-[#4b4f58] opacity-40"
			style="animation-delay: 0.15s;"
		></div>
		<div
			class="typing-dot mx-[3px] h-[6px] w-[6px] rounded-full bg-[#4b4f58] opacity-40"
			style="animation-delay: 0.3s;"
		></div>
	</div>
</div>

<style>
	.typing-dot {
		animation: typing 1.5s ease-in-out infinite;
	}

	@keyframes typing {
		0%,
		40%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		20% {
			transform: translateY(-7px);
			opacity: 1;
		}
	}
</style>
