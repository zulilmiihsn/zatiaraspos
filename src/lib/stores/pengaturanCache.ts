import { writable } from 'svelte/store';

export interface PengaturanData {
  locked_pages?: string[];
  pin?: string;
}

export interface PengaturanCache {
  data: PengaturanData | null;
  lastFetched: number;
}

// Default pengaturan untuk offline mode
const defaultPengaturan: PengaturanData = {
  locked_pages: ['laporan', 'beranda'],
  pin: '1234'
};

// Load cache dari localStorage saat inisialisasi
let initialCache: PengaturanCache = {
  data: null,
  lastFetched: 0
};

if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('pengaturanCache');
    if (cached) {
      const parsed = JSON.parse(cached);
      initialCache = {
        data: parsed.data || defaultPengaturan,
        lastFetched: parsed.lastFetched || 0
      };
    }
  } catch (error) {
    console.error('Error loading pengaturan cache:', error);
    initialCache = {
      data: defaultPengaturan,
      lastFetched: 0
    };
  }
}

export const pengaturanCache = writable<PengaturanCache>(initialCache);

// Subscribe untuk menyimpan ke localStorage setiap kali cache berubah
if (typeof window !== 'undefined') {
  pengaturanCache.subscribe((cache) => {
    try {
      localStorage.setItem('pengaturanCache', JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving pengaturan cache:', error);
    }
  });
} 