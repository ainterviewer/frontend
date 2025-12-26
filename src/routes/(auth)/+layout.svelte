<script lang="ts">
	let { children } = $props();
	let imageLoaded = $state(false);
</script>

<div class="flex min-h-[calc(100vh)] bg-white">
	<!-- Left Side - Image -->
	<div class="relative hidden overflow-hidden bg-secondary/20 lg:block lg:w-1/2">
		<img
			src="/images/login.webp"
			alt="Login visual"
			class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 {imageLoaded
				? 'opacity-100'
				: 'opacity-0'}"
			onload={() => (imageLoaded = true)}
		/>
		<div class="absolute inset-0 bg-secondary/20 mix-blend-multiply"></div>
	</div>

	{@render children()}
</div>
