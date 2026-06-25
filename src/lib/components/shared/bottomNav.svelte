<script lang="ts">
	import Home from 'lucide-svelte/icons/home';
	import ShoppingBag from 'lucide-svelte/icons/shopping-bag';
	import FileText from 'lucide-svelte/icons/file-text';
	import Book from 'lucide-svelte/icons/book';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	const navs = [
		{ label: 'Beranda', icon: Home, path: '/' },
		{ label: 'Kasir', icon: ShoppingBag, path: '/pos' },
		{ label: 'Catat', icon: Book, path: '/catat' },
		{ label: 'Laporan', icon: FileText, path: '/laporan' }
	];

	let indicatorLeft = $state(0);
	let indicatorWidth = $state(0);
	let navRefs: HTMLElement[] = $state([]);

	let currentTabIndex = $state(0);

	onMount(() => {
		// Set initial tab index
		const idx = navs.findIndex((n) =>
			n.path === '/'
				? $page.url.pathname === '/'
				: $page.url.pathname === n.path || $page.url.pathname.startsWith(n.path + '/')
		);
		currentTabIndex = idx >= 0 ? idx : 0;
	});

	$effect(() => {
		const idx = navs.findIndex((n) =>
			n.path === '/'
				? $page.url.pathname === '/'
				: $page.url.pathname === n.path || $page.url.pathname.startsWith(n.path + '/')
		);
		currentTabIndex = idx >= 0 ? idx : 0;
		if (navRefs[idx]) {
			const rect = navRefs[idx].getBoundingClientRect();
			const parentRect = navRefs[0]?.parentElement?.getBoundingClientRect();
			indicatorLeft = rect.left - (parentRect?.left || 0);
			indicatorWidth = rect.width;
		}
	});

	function handleNavClick(path: string, e: Event) {
		goto(path);
	}
</script>

<nav
	class="nav-transition fixed right-0 bottom-0 left-0 z-10 flex h-[58px] items-center justify-around overflow-hidden rounded-t-sm bg-white px-0.5 shadow-[0_-6px_24px_-4px_rgba(236,72,153,0.13)]"
	style="position:relative;"
>
	{#each navs as nav, i}
		<a
			class="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-0 border-none bg-transparent py-1 text-center text-xs font-medium text-pink-500 transition-colors duration-200 ease-out {nav.path ===
			'/'
				? $page.url.pathname === '/'
					? 'text-pink-600'
					: 'text-pink-300'
				: $page.url.pathname === nav.path || $page.url.pathname.startsWith(nav.path + '/')
					? 'text-pink-600'
					: 'text-pink-300'}"
			aria-label={nav.label}
			bind:this={navRefs[i]}
			href={nav.path}
			onclick={(e) => handleNavClick(nav.path, e)}
		>
			<svelte:component
				this={nav.icon}
				size={18}
				class="mb-0.5 block h-[18px] w-[18px] stroke-[1.7] transition-colors duration-200 ease-out"
			/>
			{nav.label}
		</a>
	{/each}
	<div class="nav-indicator" style="left:{indicatorLeft}px; width:{indicatorWidth}px;"></div>
</nav>

<style>
	.nav-indicator {
		position: absolute;
		bottom: 0;
		height: 3px;
		border-radius: 2px 2px 0 0;
		background: #e94e8f;
		transition:
			left 0.28s cubic-bezier(0.4, 0, 0.2, 1),
			width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 2;
	}
</style>
