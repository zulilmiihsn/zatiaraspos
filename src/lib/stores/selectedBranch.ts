import { writable } from 'svelte/store';

let initialBranch: 'samarinda' | 'berau' | 'dev' = 'samarinda';
if (typeof window !== 'undefined') {
  const saved = sessionStorage.getItem('selectedBranch');
  if (saved === 'berau' || saved === 'samarinda' || saved === 'dev') {
    initialBranch = saved;
  }
}
export const selectedBranch = writable<'samarinda' | 'berau' | 'dev'>(initialBranch);

if (typeof window !== 'undefined') {
  selectedBranch.subscribe(val => sessionStorage.setItem('selectedBranch', val));
} 