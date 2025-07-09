import { writable } from 'svelte/store';

export const produkCache = writable({
  data: null,
  lastFetched: 0
}); 