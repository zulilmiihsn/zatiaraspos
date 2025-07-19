import { writable } from 'svelte/store';

let initialBranch: 'samarinda' | 'berau' = 'samarinda';
if (typeof window !== 'undefined') {
  const saved = sessionStorage.getItem('selectedBranch');
  if (saved === 'berau' || saved === 'samarinda') {
    initialBranch = saved;
  }
}
export const selectedBranch = writable<'samarinda' | 'berau'>(initialBranch);

if (typeof window !== 'undefined') {
  selectedBranch.subscribe(val => sessionStorage.setItem('selectedBranch', val));
} 