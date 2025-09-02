<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onMount, onDestroy } from 'svelte';

	const dispatch = createEventDispatcher();

	export let show = false;
	export let message = '';
	export let type: 'success' | 'error' | 'warning' | 'info' = 'success';
	export let duration = 2000; // Default 2 seconds
	export let position: 'top' | 'bottom' = 'top';
	export let autoDismiss = true; // Always true

	let timeoutId: unknown;

	$: if (show && autoDismiss && duration > 0) {
		if (timeoutId) clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			show = false;
			dispatch('dismiss');
		}, duration);
	}

	// Cleanup on component destroy
	onDestroy(() => {
		if (timeoutId) clearTimeout(timeoutId);
	});

	// Get background color based on type
	function getBgColor() {
		switch (type) {
			case 'success':
				return 'bg-green-500';
			case 'error':
				return 'bg-red-500';
			case 'warning':
				return 'bg-yellow-500';
			case 'info':
				return 'bg-blue-500';
			default:
				return 'bg-green-500';
		}
	}

	// Get border color based on type
	function getBorderColor() {
		switch (type) {
			case 'success':
				return 'border-green-400';
			case 'error':
				return 'border-red-400';
			case 'warning':
				return 'border-yellow-400';
			case 'info':
				return 'border-blue-400';
			default:
				return 'border-green-400';
		}
	}
</script>

{#if show}
	<div
		class="fixed left-1/2 z-50 flex max-w-[90vw] min-w-[200px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-center font-semibold text-white shadow-lg transition-all duration-300 ease-out {getBgColor()} border {getBorderColor()}"
		style="transform: translateX(-50%); {position === 'top' ? 'top: 20px;' : 'bottom: 20px;'}"
		in:fly={{ y: position === 'top' ? -32 : 32, duration: 300, easing: cubicOut }}
		out:fade={{ duration: 200 }}
	>
		<span class="flex-shrink-0">
			{#if type === 'success'}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"
					></path>
				</svg>
			{:else if type === 'error'}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			{:else if type === 'warning'}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
					></path>
				</svg>
			{:else if type === 'info'}
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
			{/if}
		</span>
		<span class="flex-1">{message}</span>
	</div>
{/if}
