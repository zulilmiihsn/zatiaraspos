import { set, get, del } from 'idb-keyval';
import { supabase } from '$lib/database/supabaseClient';
import { transaksiPendingCount } from './transaksiPendingCount';

const KEY = 'pendingTransaksi';

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

// Listener: sync otomatis saat online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingTransaksi();
  });
} 