<script lang="ts">
	import { onMount } from 'svelte';
	import { getPendingTransactions } from '$lib/utils/offline';
	import WifiOff from 'lucide-svelte/icons/wifi-off';

	let pendingCount = $state(0);
	let isOffline = $state(typeof navigator !== 'undefined' ? !navigator.onLine : false);

	onMount(() => {
		const updatePendingCount = async () => {
			pendingCount = (await getPendingTransactions()).length;
		};
		const markOffline = () => (isOffline = true);
		const markOnline = () => (isOffline = false);

		void updatePendingCount();
		window.addEventListener('storage', updatePendingCount);
		window.addEventListener('offline', markOffline);
		window.addEventListener('online', markOnline);

		return () => {
			window.removeEventListener('storage', updatePendingCount);
			window.removeEventListener('offline', markOffline);
			window.removeEventListener('online', markOnline);
		};
	});
</script>

{#if isOffline}
	<span
		class="status-enter ml-2 flex min-w-[70px] items-center gap-1 rounded-full border border-pink-200 bg-pink-100 px-2.5 py-1.5 text-xs font-semibold text-pink-600 shadow-sm"
	>
		<WifiOff class="h-4 w-4 text-pink-400" />
		<span class="tracking-wide">Offline</span>
	</span>
{/if}

{#if pendingCount > 0}
	<div class="flex items-center gap-3">
		<div
			class="flex h-6 w-6 animate-pulse items-center justify-center rounded-full border-2 border-white bg-yellow-400 text-xs font-semibold text-white shadow transition-transform duration-300"
		>
			<span class="mb-px">{pendingCount}</span>
		</div>
	</div>
{/if}

<style>
	.status-enter {
		animation: status-in 0.5s cubic-bezier(0.4, 1.4, 0.6, 1);
	}

	@keyframes status-in {
		from {
			transform: translateY(-8px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
