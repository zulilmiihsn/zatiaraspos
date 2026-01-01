import { writable } from 'svelte/store';

let initialBranch: 'samarinda' | 'berau' | 'Balikpapan' | 'samarinda2' = 'samarinda';
if (typeof window !== 'undefined') {
	const saved = localStorage.getItem('selectedBranch'); // Changed to localStorage
	if (saved === 'berau' || saved === 'samarinda' || saved === 'Balikpapan' || saved === 'samarinda2') {
		initialBranch = saved;
	}
}
export const selectedBranch = writable<'samarinda' | 'berau' | 'Balikpapan' | 'samarinda2'>(initialBranch);

if (typeof window !== 'undefined') {
	selectedBranch.subscribe((val) => localStorage.setItem('selectedBranch', val)); // Changed to localStorage
}
