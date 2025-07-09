import { writable } from 'svelte/store';

export const tambahanCache = writable({
  data: null,
  lastFetched: 0
}); 