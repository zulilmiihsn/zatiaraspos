import { writable } from 'svelte/store';

export const pengaturanCache = writable({
  data: null,
  lastFetched: 0
}); 