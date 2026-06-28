const fs = require('fs');

const path = 'd:/Projects/zatiaraspos/src/routes/pengaturan/pemilik/manajemenmenu/+page.svelte';
let content = fs.readFileSync(path, 'utf8');

// The new script block
const newScript = `<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { createManajemenmenuState } from '$lib/stores/manajemenmenuState.svelte';

	// Komponen Icon
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import Plus from 'lucide-svelte/icons/plus';
	import Pizza from 'lucide-svelte/icons/pizza';
	import CupSoda from 'lucide-svelte/icons/cup-soda';

	// Sub Komponen Tab
	import MenuTab from '$lib/components/pengaturan/manajemenmenu/MenuTab.svelte';
	import KategoriTab from '$lib/components/pengaturan/manajemenmenu/KategoriTab.svelte';
	import EkstraTab from '$lib/components/pengaturan/manajemenmenu/EkstraTab.svelte';
	import BahanTab from '$lib/components/pengaturan/manajemenmenu/BahanTab.svelte';
	import HppTab from '$lib/components/pengaturan/manajemenmenu/HppTab.svelte';

	// Modal
	import ToastNotification from '$lib/components/ui/ToastNotification.svelte';
	import CropperDialog from '$lib/components/CropperDialog.svelte';

	const s = createManajemenmenuState();
</script>
`;

// Extract everything after </script>
const scriptEndIndex = content.indexOf('</script>') + '</script>'.length;
let markup = content.substring(scriptEndIndex);

const vars = [
	'toastManager', 'activeTab', 'openMenuForm', 'openKategoriForm', 'openEkstraForm', 'openBahanForm',
	'searchKeyword', 'selectedKategori', 'isGridView', 'isLoadingKategori', 'isLoadingMenus', 'kategoriList', 'filteredMenus',
	'confirmDeleteMenu', 'handleImgError', 'searchKategoriKeyword', 'menus', 'confirmDeleteKategori',
	'searchEkstra', 'isLoadingEkstra', 'ekstraList', 'confirmDeleteEkstra',
	'searchBahan', 'isLoadingBahan', 'bahanList', 'formatCurrency', 'openMutasiBahanForm', 'confirmDeleteBahan',
	'hppForm', 'hppPurchaseText', 'hppSettings', 'hppParsedItems', 'isParsingHpp', 'getOverheadMonthly', 'getOverheadPerItem',
	'getProductRecipeCost', 'getProductHpp', 'getProductMargin', 'saveHppSettings', 'parseHppPurchaseText', 'saveParsedHppItem',
	'showMenuForm', 'closeMenuForm', 'editMenuId', 'saveMenu', 'menuForm', 'fileInputEl', 'removeImage', 'handleFileChange',
	'setTrackStock', 'setTrackIngredients', 'recipeDraft', 'addRecipeItem', 'recipeItems', 'getBahanName', 'formatRupiah', 'getBahanUnit', 'removeRecipeItem',
	'setMenuType', 'setMenuKategori', 'toggleEkstra',
	'showKategoriDetailModal', 'closeKategoriDetailModal', 'kategoriDetail', 'saveKategoriDetail', 'kategoriDetailName', 'selectedMenuIds', 'toggleMenuInKategoriRealtime', 'unselectedMenuIds',
	'showEkstraForm', 'editEkstraId', 'ekstraForm', 'saveEkstra', 'handleRupiahInput',
	'showBahanForm', 'closeBahanForm', 'editBahanId', 'saveBahan', 'bahanForm',
	'showMutasiBahanForm', 'closeMutasiBahanForm', 'saveMutasiBahan', 'mutasiBahanForm',
	'showDeleteModal', 'cancelDeleteMenu', 'doDeleteMenu',
	'showDeleteKategoriModal', 'cancelDeleteKategori', 'doDeleteKategori',
	'showDeleteEkstraModal', 'cancelDeleteEkstra', 'doDeleteEkstra',
	'showDeleteBahanModal', 'cancelDeleteBahan', 'doDeleteBahan',
	'showNotifModal', 'notifModalMsg', 'notifModalType',
	'showCropperDialog', 'cropperDialogImage', 'handleCropperDone', 'handleCropperCancel'
];

vars.forEach(v => {
	// Svelte binding attributes exception: bind:keyword={keyword} or bind:keyword => bind:keyword={s.keyword}
	markup = markup.replace(new RegExp(`bind:${v}\\s*(?=[=>\\s])`, 'g'), `bind:${v}={s.${v}}`);
	
	// FIX: For component shorthand props `{v}`, we need to replace it with `v={s.v}` if it's used as an attribute.
	// We can detect it if it's preceded by whitespace or newline inside a tag. Since regex inside tags is hard,
	// let's just do a manual string replace for the known component props blocks.
});

// Fix all the known {prop} shorthand passing in the markup
const propsToExpand = [
	'isLoadingKategori', 'isLoadingMenus', 'kategoriList', 'filteredMenus', 'openMenuForm', 'confirmDeleteMenu', 'handleImgError',
	'searchKategoriKeyword', 'menus', 'openKategoriForm', 'confirmDeleteKategori',
	'searchEkstra', 'isLoadingEkstra', 'ekstraList', 'openEkstraForm', 'confirmDeleteEkstra',
	'searchBahan', 'isLoadingBahan', 'bahanList', 'formatCurrency', 'openBahanForm', 'openMutasiBahanForm', 'confirmDeleteBahan',
	'hppSettings', 'hppParsedItems', 'isParsingHpp', 'getOverheadMonthly', 'getOverheadPerItem', 'getProductRecipeCost',
	'getProductHpp', 'getProductMargin', 'saveHppSettings', 'parseHppPurchaseText', 'saveParsedHppItem'
];

propsToExpand.forEach(prop => {
	// Replace {prop} with prop={s.prop} if it is preceded by a newline or whitespace
	markup = markup.replace(new RegExp(`(\\s)\\{${prop}\\}`, 'g'), `$1${prop}={s.${prop}}`);
});

// Also replace `{v}` with `{s.v}` for normal text interpolation
vars.forEach(v => {
	markup = markup.replace(new RegExp(`\\{${v}\\}`, 'g'), `{s.${v}}`);
});

// Now word replacement for everything else (like menuForm.nama, activeTab === 'menu', etc)
vars.forEach(v => {
	markup = markup.replace(new RegExp(`\\b${v}\\b`, 'g'), (match, offset, string) => {
		if (string[offset - 1] === '.') return match;
		if (string.substring(Math.max(0, offset - 5), offset) === 'bind:') return match;
		if (string.substring(Math.max(0, offset - 3), offset) === '{s.') return match;
		if (string[offset + match.length] === ':') return match;
		if (string[offset + match.length] === '=' && string[offset - 1] === ' ') return match; 
		if (string.substring(Math.max(0, offset - match.length - 3), offset) === `s.${v}={s.`) return match;
		return `s.${match}`;
	});
});

markup = markup.replace(/={s\.[^}]+}={s\.[^}]+}/g, (match) => match.split('=')[1]);

const finalContent = newScript + markup;
fs.writeFileSync(path, finalContent, 'utf8');
console.log('Refactor script completed successfully.');
