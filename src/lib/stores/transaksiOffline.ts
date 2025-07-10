import { set, get } from 'idb-keyval';
import { supabase } from '$lib/database/supabaseClient';
import { transaksiPendingCount } from './transaksiPendingCount';

const KEY = 'pendingTransaksi';
const MENU_KEY = 'pendingMenus';
const KATEGORI_KEY = 'pendingKategori';
const TAMBAHAN_KEY = 'pendingTambahan';

export async function saveTransaksiOffline(trx: any) {
  let pending = await get(KEY) || [];
  pending.push(trx);
  await set(KEY, pending);
  transaksiPendingCount.set(pending.length);
}

export async function getPendingTransaksi() {
  const pending = (await get(KEY)) || [];
  transaksiPendingCount.set(pending.length);
  return pending;
}

export async function clearPendingTransaksi() {
  await set(KEY, []);
  transaksiPendingCount.set(0);
}

export async function syncPendingTransaksi() {
  const pending = await getPendingTransaksi();
  if (!pending.length) return;
  const sukses: any[] = [];
  for (const trx of pending) {
    try {
      const { error } = await supabase.from('buku_kas').insert([trx]);
      if (!error) sukses.push(trx);
    } catch (e) { /* offline lagi, stop sync */ break; }
  }
  // Hapus yang sudah sukses
  if (sukses.length) {
    const sisa = pending.filter((t: any) => !sukses.includes(t));
    await set(KEY, sisa);
    transaksiPendingCount.set(sisa.length);
  }
}

// Menu offline functions
export async function saveMenuOffline(menu: any) {
  let pending = await get(MENU_KEY) || [];
  pending.push(menu);
  await set(MENU_KEY, pending);
}

export async function getPendingMenus() {
  return (await get(MENU_KEY)) || [];
}

export async function clearPendingMenus() {
  await set(MENU_KEY, []);
}

// Tambahkan fungsi untuk menghapus menu offline
export async function deleteMenuOffline(menuId: number) {
  let pending = await get(MENU_KEY) || [];
  pending = pending.filter((menu: any) => menu.id !== menuId);
  await set(MENU_KEY, pending);
}

// Tambahkan fungsi untuk sync delete menu
export async function syncDeleteMenu(menuId: number) {
  // Hapus dari pending menus jika ada
  await deleteMenuOffline(menuId);
  
  // Clear cache produk untuk memaksa refresh
  if (typeof window !== 'undefined') {
    localStorage.removeItem('produkCache');
  }
}

export async function syncPendingMenus() {
  const pending = await getPendingMenus();
  if (!pending.length) return;
  const sukses: any[] = [];
  for (const menu of pending) {
    try {
      const { error } = await supabase.from('produk').insert([menu]);
      if (!error) sukses.push(menu);
    } catch (e) { /* offline lagi, stop sync */ break; }
  }
  // Hapus yang sudah sukses
  if (sukses.length) {
    const sisa = pending.filter((m: any) => !sukses.includes(m));
    await set(MENU_KEY, sisa);
  }
}

// Kategori offline functions
export async function saveKategoriOffline(kategori: any) {
  let pending = await get(KATEGORI_KEY) || [];
  pending.push(kategori);
  await set(KATEGORI_KEY, pending);
}

export async function getPendingKategori() {
  return (await get(KATEGORI_KEY)) || [];
}

export async function clearPendingKategori() {
  await set(KATEGORI_KEY, []);
}

export async function syncPendingKategori() {
  const pending = await getPendingKategori();
  if (!pending.length) return;
  const sukses: any[] = [];
  for (const kategori of pending) {
    try {
      const { error } = await supabase.from('kategori').insert([kategori]);
      if (!error) sukses.push(kategori);
    } catch (e) { /* offline lagi, stop sync */ break; }
  }
  // Hapus yang sudah sukses
  if (sukses.length) {
    const sisa = pending.filter((k: any) => !sukses.includes(k));
    await set(KATEGORI_KEY, sisa);
  }
}

// Tambahan offline functions
export async function saveTambahanOffline(tambahan: any) {
  let pending = await get(TAMBAHAN_KEY) || [];
  pending.push(tambahan);
  await set(TAMBAHAN_KEY, pending);
}

export async function getPendingTambahan() {
  return (await get(TAMBAHAN_KEY)) || [];
}

export async function clearPendingTambahan() {
  await set(TAMBAHAN_KEY, []);
}

export async function syncPendingTambahan() {
  const pending = await getPendingTambahan();
  if (!pending.length) return;
  const sukses: any[] = [];
  for (const tambahan of pending) {
    try {
      const { error } = await supabase.from('tambahan').insert([tambahan]);
      if (!error) sukses.push(tambahan);
    } catch (e) { /* offline lagi, stop sync */ break; }
  }
  // Hapus yang sudah sukses
  if (sukses.length) {
    const sisa = pending.filter((t: any) => !sukses.includes(t));
    await set(TAMBAHAN_KEY, sisa);
  }
}

// Sync semua pending saat online
export async function syncAllPending() {
  await syncPendingTransaksi();
  await syncPendingMenus();
  await syncPendingKategori();
  await syncPendingTambahan();
}

// Listener: sync otomatis saat online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncAllPending();
  });
} 