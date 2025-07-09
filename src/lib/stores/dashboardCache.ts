import { writable } from 'svelte/store';

export const dashboardCache = writable({
  data: null,
  lastFetched: 0
}); 