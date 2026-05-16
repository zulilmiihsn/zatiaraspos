import re

with open('src/routes/pengaturan/kasir/riwayat/+page.svelte', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("let pengaturanStruk: any = null;", "let pengaturanStruk: import('$lib/types/laporan').ReceiptSettings | null = null;")
content = content.replace("let transaksiHariIni: any[] = [];", "let transaksiHariIni: Record<string, unknown>[] = [];")
content = content.replace("let pollingInterval: any;", "let pollingInterval: number | null = null;")
content = content.replace("let selectedTransaksi: any = null;", "let selectedTransaksi: Record<string, unknown> | null = null;")
content = content.replace("function openDetail(trx: any)", "function openDetail(trx: Record<string, unknown>)")
content = content.replace("let items: any[] = [];", "let items: Record<string, unknown>[] = [];")
content = content.replace("items.forEach((item: any, idx: any)", "items.forEach((item: Record<string, unknown>, idx: number)")
content = content.replace("let aiHandler: any;", "let aiHandler: EventListener;")
content = content.replace("window.addEventListener('ai-recommendations-applied', aiHandler as any);", "window.addEventListener('ai-recommendations-applied', aiHandler);")
content = content.replace("(window as any).__refreshRiwayatKasir", "(window as Record<string, unknown>).__refreshRiwayatKasir")
content = content.replace("window.removeEventListener('ai-recommendations-applied', aiHandler as any);", "window.removeEventListener('ai-recommendations-applied', aiHandler);")
content = content.replace("delete (window as any).__refreshRiwayatKasir;", "delete (window as Record<string, unknown>).__refreshRiwayatKasir;")

with open('src/routes/pengaturan/kasir/riwayat/+page.svelte', 'w', encoding='utf-8') as f:
    f.write(content)
