import { writable } from 'svelte/store';

export const laporanCache = writable({
  data: null,
  lastFetched: 0
}); 