<script lang="ts">
	import Settings from 'lucide-svelte/icons/settings';
	import type { Snippet } from 'svelte';
	import TopBarStatus from './topBarStatus.svelte';
	import TopBarAiAssistant from './topBarAiAssistant.svelte';
	let {
		children,
		actions,
		download,
		showSettings = true,
		onAiRecommendationsApplied
	}: {
		children?: Snippet;
		actions?: Snippet;
		download?: Snippet;
		showSettings?: boolean;
		onAiRecommendationsApplied?: (detail: unknown) => void;
	} = $props();
</script>

<div class="nav-transition z-10 flex items-center justify-between bg-white px-4 pt-4 pb-3">
	<div class="flex items-center gap-3">
		<TopBarAiAssistant onRecommendationsApplied={onAiRecommendationsApplied} />
		<TopBarStatus />
	</div>
	<div class="flex-1 text-center text-lg font-medium tracking-wide text-gray-800">
		{@render children?.()}
	</div>
	<div class="flex items-center gap-2">
		<!-- Slot untuk actions -->
		{@render actions?.()}

		{#if showSettings}
			<a
				href="/pengaturan"
				aria-label="Pengaturan"
				class="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-lg border-[1.5px] border-gray-200 bg-white text-2xl text-pink-500 shadow-lg shadow-pink-500/7 transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12"
			>
				<Settings size={22} />
			</a>
		{:else}
			<div class="h-[38px] w-[38px]"></div>
		{/if}

		<!-- Slot untuk download -->
		{@render download?.()}
	</div>
</div>
