<script lang="ts">
	import '../app.css';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import BottomNav from '$lib/components/shared/BottomNav.svelte';
	let { children } = $props();
</script>

<div class="flex flex-col h-screen min-h-0 bg-white">
	<div class="sticky top-0 z-30 bg-white">
		<Topbar />
	</div>
	<div class="flex-1 min-h-0 overflow-y-auto">
		{@render children()}
	</div>
	<div class="sticky bottom-0 z-30 bg-white">
		<BottomNav />
	</div>
</div>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no" />
</svelte:head>
