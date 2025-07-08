<script lang="ts">
	import '../app.css';
	import Topbar from '$lib/components/shared/Topbar.svelte';
	import BottomNav from '$lib/components/shared/BottomNav.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import { supabase } from '$lib/database/supabaseClient';
	import Download from 'lucide-svelte/icons/download';

	export const data = {};
	
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
	onMount(async () => {
		const currentPath = $page.url.pathname;
		const publicPaths = ['/login', '/unauthorized'];
		
		// Skip auth check for public paths
		if (publicPaths.includes(currentPath)) {
			return;
		}
		
		// Cek session Supabase
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			goto('/login');
			return;
		}
		
		// Cek role jika akses /admin
		if (currentPath.startsWith('/admin')) {
			const userId = session.user.id;
			const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
			if (!profile || profile.role !== 'admin') {
				goto('/unauthorized');
				return;
			}
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
		<div class="sticky top-0 z-30 bg-white shadow-md">
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
			<div class="sticky top-0 z-30 bg-white shadow-md">
				<Topbar>
					<svelte:fragment slot="download">
						{#if $page.url.pathname === '/laporan'}
							<button class="w-[38px] h-[38px] rounded-lg bg-white border-[1.5px] border-gray-200 flex items-center justify-center text-2xl text-pink-500 shadow-lg shadow-pink-500/7 cursor-pointer transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12 mr-2" aria-label="Download Laporan">
								<Download size={22} />
							</button>
						{/if}
					</svelte:fragment>
					<svelte:fragment slot="actions"></svelte:fragment>
				</Topbar>
			</div>
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
