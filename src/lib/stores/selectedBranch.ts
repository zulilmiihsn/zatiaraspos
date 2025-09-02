import { writable } from 'svelte/store';

let initialBranch: 'samarinda' | 'berau' | 'dev' = 'samarinda';
if (typeof window !== 'undefined') {
	const saved = localStorage.getItem('selectedBranch'); // Changed to localStorage
	if (saved === 'berau' || saved === 'samarinda' || saved === 'dev') {
		initialBranch = saved;
	}
}
export const selectedBranch = writable<'samarinda' | 'berau' | 'dev'>(initialBranch);

if (typeof window !== 'undefined') {
	selectedBranch.subscribe((val) => localStorage.setItem('selectedBranch', val)); // Changed to localStorage
}


