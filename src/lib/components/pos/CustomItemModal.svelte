<script lang="ts">
	import ModalSheet from '$lib/components/shared/modalSheet.svelte';
	import { formatRupiah } from '$lib/utils/currency';

	let { show = $bindable(false), onAdd } = $props<{
		show: boolean;
		onAdd: (item: any) => void;
	}>();

	let customItemName = $state('');
	let customItemPriceRaw = '';
	let customItemPriceFormatted = $state('');
	let customItemNote = $state('');
	let jumlah = $state(1);

	function handleCustomPriceInput(e: Event): void {
		const target = e.target as HTMLInputElement;
		const raw = target.value.replace(/[^\d]/g, '');
		customItemPriceRaw = raw;
		customItemPriceFormatted = formatRupiah(raw);
	}

	function decQty() {
		if (jumlah > 1) jumlah--;
	}
	function incQty() {
		if (jumlah < 99) jumlah++;
	}

	function handleAdd(e?: Event) {
		if (e) e.preventDefault();
		if (
			!customItemName.trim() ||
			!customItemPriceRaw ||
			isNaN(Number(customItemPriceRaw)) ||
			Number(customItemPriceRaw) <= 0
		)
			return;
		onAdd({
			product: {
				id: `custom-${Date.now()}`,
				nama: customItemName.trim(),
				harga: Number(customItemPriceRaw),
				tipe: 'custom'
			},
			addOns: [],
			gula: '',
			es: '',
			jumlah: jumlah,
			catatan: customItemNote.trim()
		});
		show = false;
		// reset
		customItemName = '';
		customItemPriceRaw = '';
		customItemPriceFormatted = '';
		customItemNote = '';
		jumlah = 1;
	}

	function handleStopPropagation(e: Event): void {
		e.stopPropagation();
	}
</script>

{#if show}
	<ModalSheet
		bind:open={show}
		title={customItemName ? customItemName : 'Menu Kustom'}
		onclose={() => (show = false)}
	>
		<div
			class="addon-list addon-modal-content min-h-0 flex-1 overflow-y-auto pb-48"
			onclick={handleStopPropagation}
			onkeydown={(e) => e.key === 'Escape' && e.stopPropagation()}
			style="scrollbar-width:none;-ms-overflow-style:none;"
			role="button"
			tabindex="0"
		>
			<div class="mt-4 mb-6">
				<label class="mb-2 block text-base font-semibold text-gray-800" for="custom-nama"
					>Nama Menu</label
				>
				<input
					id="custom-nama"
					class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base font-semibold text-gray-800 outline-none focus:border-pink-400 focus:outline-2 focus:outline-pink-400"
					type="text"
					bind:value={customItemName}
					required
					maxlength="50"
					placeholder="Contoh: Jus Mangga Spesial"
				/>
			</div>
			<div class="mb-6">
				<label class="mt-4 mb-2 block text-base font-semibold text-gray-800" for="custom-harga"
					>Harga</label
				>
				<div class="relative">
					<span class="absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-gray-400"
						>Rp</span
					>
					<input
						id="custom-harga"
						class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-10 text-base font-semibold text-gray-800 outline-none focus:border-pink-400 focus:outline-2 focus:outline-pink-400"
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						min="1"
						max="99999999"
						value={customItemPriceFormatted}
						oninput={handleCustomPriceInput}
						required
						placeholder="0"
					/>
				</div>
			</div>
			<div class="mb-6">
				<label class="mt-4 mb-2 block text-base font-semibold text-gray-800" for="custom-catatan"
					>Catatan</label
				>
				<textarea
					id="custom-catatan"
					class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base font-normal text-gray-800 outline-none focus:border-pink-400 focus:outline-2 focus:outline-pink-400"
					bind:value={customItemNote}
					maxlength="100"
					rows="2"
					placeholder="Contoh: Tanpa gula, es sedikit, dsb"
				></textarea>
			</div>
			<div class="mt-0 mb-2 text-base font-semibold text-gray-800">Jumlah</div>
			<div class="mb-4 flex items-center justify-center gap-3">
				<button
					class="flex h-10 w-10 items-center justify-center rounded-lg border border-pink-400 text-xl font-bold text-pink-400 transition-colors duration-150"
					type="button"
					onclick={decQty}>-</button
				>
				<input
					class="w-12 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-center text-lg font-semibold text-gray-800 outline-none"
					type="number"
					min="1"
					max="99"
					bind:value={jumlah}
				/>
				<button
					class="flex h-10 w-10 items-center justify-center rounded-lg border border-pink-400 text-xl font-bold text-pink-400 transition-colors duration-150"
					type="button"
					onclick={incQty}>+</button
				>
			</div>
			<div class="mt-2 flex gap-3">
				<button
					type="button"
					class="mb-1 w-full rounded-lg bg-pink-500 px-6 py-3 text-lg font-bold text-white shadow transition-colors duration-150 hover:bg-pink-600 active:bg-pink-700"
					onclick={handleAdd}>Tambah ke Keranjang</button
				>
			</div>
		</div>
	</ModalSheet>
{/if}
