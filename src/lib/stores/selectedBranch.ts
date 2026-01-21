import { writable } from 'svelte/store';

let initialBranch: 'samarinda' | 'berau' | 'balikpapan' | 'samarinda2' | 'balikpapan2' = 'samarinda';
if (typeof window !== 'undefined') {
	let saved = localStorage.getItem('selectedBranch'); // Changed to localStorage
	// Migration legacy value
	if (saved === 'Balikpapan') saved = 'balikpapan';

	if (saved === 'berau' || saved === 'samarinda' || saved === 'balikpapan' || saved === 'samarinda2' || saved === 'balikpapan2') {
		initialBranch = saved;
	}
}
export const selectedBranch = writable<'samarinda' | 'berau' | 'balikpapan' | 'samarinda2' | 'balikpapan2'>(initialBranch);

if (typeof window !== 'undefined') {
	selectedBranch.subscribe((val) => localStorage.setItem('selectedBranch', val)); // Changed to localStorage
}
