<script lang="ts">
	import '../app.css';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import BottomNav from '$lib/components/shared/BottomNav.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { auth, session } from '$lib/auth.js';
	import { SecurityMiddleware } from '$lib/security.js';
	import { goto } from '$app/navigation';

	export let data;
	
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

{#if $page.url.pathname === '/login' || $page.url.pathname === '/unauthorized' || $page.url.pathname === '/pengaturan' || $page.url.pathname === '/pengaturan/printer' || $page.url.pathname === '/pengaturan/pemilik'}
	<!-- Public pages and settings page without navigation -->
	<slot />
{:else if $page.url.pathname === '/pos/bayar'}
	<div class="flex flex-col h-screen min-h-0 bg-white">
		<div class="flex-1 min-h-0 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<slot />
		</div>
	</div>
{:else if $page.url.pathname !== '/laporan'}
	<div class="flex flex-col h-screen min-h-0 bg-white">
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
	<div class="flex flex-col h-screen min-h-0 bg-white">
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
