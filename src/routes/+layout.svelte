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
	import { posGridView } from '$lib/stores/posGridView';
	import { slide, fade, fly } from 'svelte/transition';

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
			const { data: profile } = await supabase.from('profil').select('role').eq('id', userId).single();
			if (!profile || profile.role !== 'admin') {
				goto('/unauthorized');
				return;
			}
		}
	});

	let isPosPage = false;
	let posGridViewValue = true;
	let tokoAktif = false; // TODO: Nanti dihubungkan ke state global/store dari page beranda

	$: isPosPage = $page.url.pathname === '/pos';

	$: if (isPosPage) {
		const unsubscribe = posGridView.subscribe(v => posGridViewValue = v);
	}
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
{:else}
	<div class="flex flex-col h-screen min-h-0 bg-white page-transition">
		{#if $page.url.pathname !== '/laporan'}
			<div class="sticky top-0 z-30 bg-white shadow-md">
				<Topbar onSettings={undefined}>
					<svelte:fragment slot="actions">
						{#if $page.url.pathname === '/'}
							<!-- Button Buka/Tutup Toko dihapus sesuai permintaan user -->
						{/if}
						{#if $page.url.pathname === '/pos'}
							<button
								class="p-2 rounded-lg border border-gray-200 bg-white hover:bg-pink-50 transition-colors flex items-center justify-center mr-2"
								on:click={() => posGridView.update(v => !v)}
								aria-label={$posGridView ? 'Tampilkan List' : 'Tampilkan Grid'}
								type="button"
							>
								{#if $posGridView}
									<!-- Icon Grid -->
									<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>
								{:else}
									<!-- Icon List -->
									<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
								{/if}
							</button>
						{/if}
					</svelte:fragment>
				</Topbar>
			</div>
		{/if}
		{#if $page.url.pathname === '/laporan'}
			<div class="sticky top-0 z-30 bg-white shadow-md">
				<Topbar onSettings={undefined}>
					<svelte:fragment slot="download">
						<button class="w-[38px] h-[38px] rounded-lg bg-white border-[1.5px] border-gray-200 flex items-center justify-center text-2xl text-pink-500 shadow-lg shadow-pink-500/7 cursor-pointer transition-all duration-150 active:border-pink-500 active:shadow-xl active:shadow-pink-500/12 mr-2" aria-label="Download Laporan">
							<Download size={22} />
						</button>
					</svelte:fragment>
					<svelte:fragment slot="actions"></svelte:fragment>
				</Topbar>
			</div>
		{/if}
		<div class="flex-1 min-h-0 overflow-y-auto"
			style="scrollbar-width:none;-ms-overflow-style:none;"
		>
			<slot />
		</div>
	</div>
{/if}

{#if $page.url.pathname !== '/login' && $page.url.pathname !== '/unauthorized' && $page.url.pathname !== '/pengaturan' && $page.url.pathname !== '/pengaturan/printer' && $page.url.pathname !== '/pengaturan/pemilik' && $page.url.pathname !== '/pos/bayar'}
	<div class="sticky bottom-0 z-30 bg-white">
		<BottomNav />
	</div>
{/if}

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no" />
	<title>ZatiarasPOS</title>
</svelte:head>
