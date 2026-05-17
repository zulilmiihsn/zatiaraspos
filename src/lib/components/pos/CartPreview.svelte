<script lang="ts">
	import { fly } from 'svelte/transition';

	let {
		cart = [],
		totalItems = 0,
		totalHarga = 0,
		onOpenCart,
		onGoToBayar,
		onClearCart
	} = $props<{
		cart: any[];
		totalItems: number;
		totalHarga: number;
		onOpenCart: () => void;
		onGoToBayar: (e: Event) => void;
		onClearCart: () => void;
	}>();

	let cartPreviewRef = $state<HTMLDivElement | null>(null);
	let cartPreviewStartX = $state(0);
	let cartPreviewX = $state(0);
	let cartPreviewDragging = $state(false);

	function handleCartPreviewTouchStart(e: TouchEvent) {
		cartPreviewStartX = e.touches[0].clientX;
		cartPreviewDragging = true;
	}

	function handleCartPreviewTouchMove(e: TouchEvent) {
		if (!cartPreviewDragging) return;
		const currentX = e.touches[0].clientX;
		const diff = currentX - cartPreviewStartX;
		if (diff < 0) {
			cartPreviewX = diff;
		}
	}

	function handleCartPreviewTouchEnd() {
		cartPreviewDragging = false;
		if (cartPreviewX < -100) {
			cartPreviewX = -window.innerWidth;
			setTimeout(() => {
				onClearCart();
				cartPreviewX = 0;
			}, 300);
		} else {
			cartPreviewX = 0;
		}
	}
</script>

{#if cart.length > 0}
	<div
		bind:this={cartPreviewRef}
		class="fixed right-0 bottom-16 left-0 z-20 flex min-h-[56px] items-center justify-between rounded-t-lg border-t-2 border-gray-100 bg-white px-6 py-3 text-base font-medium text-gray-900 shadow-md"
		style="transform: translateX({cartPreviewX}px); transition: {cartPreviewDragging
			? 'none'
			: 'transform 0.25s cubic-bezier(.4,0,.2,1)'}; touch-action: pan-y;"
		ontouchstart={handleCartPreviewTouchStart}
		ontouchmove={handleCartPreviewTouchMove}
		ontouchend={handleCartPreviewTouchEnd}
		transition:fly={{ x: -64, duration: 320, opacity: 0.9 }}
	>
		<div
			class="flex flex-1 cursor-pointer flex-col justify-center select-none"
			onclick={onOpenCart}
			onkeydown={(e) => e.key === 'Enter' && onOpenCart()}
			role="button"
			tabindex="0"
			aria-label="Buka keranjang belanja"
			style="min-width:0;"
		>
			<div class="truncate text-sm text-gray-500">{totalItems} item pesanan</div>
			<div class="truncate text-lg font-bold text-pink-500">
				Rp {Number(totalHarga ?? 0).toLocaleString('id-ID')}
			</div>
		</div>
		<div class="ml-4 flex items-center justify-center">
			<button
				class="flex items-center justify-center rounded-lg bg-pink-500 px-6 py-2 text-lg font-bold text-white shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700"
				onclick={onGoToBayar}>Bayar</button
			>
		</div>
	</div>
{/if}
