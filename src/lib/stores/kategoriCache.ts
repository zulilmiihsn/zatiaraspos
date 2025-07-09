import { writable } from 'svelte/store';

export const kategoriCache = writable({
  data: null,
  lastFetched: 0
}); 