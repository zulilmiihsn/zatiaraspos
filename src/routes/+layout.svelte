<script lang="ts">
	import '../app.css';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import BottomNav from '$lib/components/shared/BottomNav.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { auth, session } from '$lib/auth.js';
	import { SecurityMiddleware } from '$lib/security.js';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';

	export let data;
	
	// Loading state for page transitions
	let isLoading = false;
	
	// Watch for navigation changes
	$: if ($navigating) {
		isLoading = true;
	} else {
		// Small delay to show loading indicator
		setTimeout(() => {
			isLoading = false;
		}, 100);
	}
	
	// Check authentication on mount
	onMount(() => {
		const currentPath = $page.url.pathname;
		const publicPaths = ['/login', '/unauthorized'];
		
		// Skip auth check for public paths
		if (publicPaths.includes(currentPath)) {
			return;
		}
		
		// Check if user is authenticated
		if (!auth.isAuthenticated()) {
			goto('/login');
			return;
		}
		
		// Check role-based access for admin routes
		if (currentPath.startsWith('/admin') && !auth.hasRole('admin')) {
			goto('/unauthorized');
			return;
		}
	});
</script>

<!-- Loading indicator -->
{#if isLoading}
	<div class="loading-indicator active"></div>
{/if}

{#if $page.url.pathname === '/login' || $page.url.pathname === '/unauthorized' || $page.url.pathname === '/pengaturan' || $page.url.pathname === '/pengaturan/printer' || $page.url.pathname === '/pengaturan/pemilik'}
	<!-- Public pages and settings page without navigation -->
	<div class="page-transition">
		<slot />
	</div>
{:else if $page.url.pathname === '/pos/bayar'}
	<div class="flex flex-col h-screen min-h-0 bg-white page-transition">
		<div class="flex-1 min-h-0 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<slot />
		</div>
	</div>
{:else if $page.url.pathname !== '/laporan'}
	<div class="flex flex-col h-screen min-h-0 bg-white page-transition">
		<div class="sticky top-0 z-30 bg-white">
			<Topbar>
				<svelte:fragment slot="actions"></svelte:fragment>
			</Topbar>
		</div>
		<div class="flex-1 min-h-0 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<slot />
		</div>
		<div class="sticky bottom-0 z-30 bg-white">
			<BottomNav />
		</div>
	</div>
{:else}
	<div class="flex flex-col h-screen min-h-0 bg-white page-transition">
		<div class="flex-1 min-h-0 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<slot />
		</div>
		<div class="sticky bottom-0 z-30 bg-white">
			<BottomNav />
		</div>
	</div>
{/if}

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no" />
	<title>ZatiarasPOS</title>
</svelte:head>
