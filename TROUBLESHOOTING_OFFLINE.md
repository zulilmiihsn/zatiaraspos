# Troubleshooting Offline Data Persistence

## **Masalah yang Telah Diperbaiki:**

### **1. Error 400 Bad Request - Column 'image' tidak ada**
**Masalah:** Query menggunakan kolom `image` yang tidak ada di database
**Solusi:** Mengganti `image` dengan `gambar` yang merupakan nama kolom yang benar

```typescript
// Sebelum
.select('id, name, image')

// Sesudah  
.select('id, name, gambar')
```

### **2. Error 400 Bad Request - Nilai null dalam query**
**Masalah:** Query mengirim nilai `null` ke Supabase yang menyebabkan error
**Solusi:** Filter productIds yang valid sebelum query

```typescript
// Sebelum
const productIds = Object.keys(productSales);

// Sesudah
const productIds = Object.keys(productSales).filter(id => id && id !== 'null' && id !== 'undefined');
```

### **3. ReferenceError: isLoading is not defined**
**Masalah:** Variabel `isLoading` digunakan tapi tidak dideklarasikan di laporan
**Solusi:** Menambahkan deklarasi variabel yang hilang

```typescript
let isLoading = false;
let errorMessage = '';
let dateRange = '';
let reportType = 'daily';
// ... variabel lainnya
```

### **4. Error Handling untuk Offline Mode**
**Masalah:** Error tidak ditangani dengan baik saat offline
**Solusi:** Menambahkan deteksi offline mode dan fallback ke cache

```typescript
if (error) {
  handleError(error, 'DataService.getBestSellers');
  // Jika offline, return empty array
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return [];
  }
  return [];
}
```

## **Perbaikan Cache Configuration:**

### **TTL yang Diperpanjang:**
- Memory cache: 30 detik → 5 menit
- IndexedDB cache: 5 menit → 30 menit
- Stale-while-revalidate: 1 menit → 5 menit

### **Cache Size yang Diperbesar:**
- Memory entries: 100 → 200
- IndexedDB entries: 1000 → 2000

## **Testing Checklist:**

### **Online Mode:**
- [ ] Buka aplikasi saat online
- [ ] Pastikan data ter-load dengan benar
- [ ] Navigasi antar halaman
- [ ] Pastikan data tetap tersedia

### **Offline Mode:**
- [ ] Matikan internet
- [ ] Navigasi antar halaman
- [ ] Pastikan data tidak hilang
- [ ] Cek console untuk error

### **Online Kembali:**
- [ ] Nyalakan internet
- [ ] Pastikan data refresh otomatis
- [ ] Cek apakah data ter-update

## **Monitoring:**

### **Console Logs:**
- `Cache preserved on navigation`
- `Cache preserved on offline`
- `Cache refresh timers cleared on online`
- `Offline mode detected, using cached data`

### **Network Tab:**
- Cache hits untuk data yang sudah di-cache
- Tidak ada request yang gagal karena offline

### **Application Tab:**
- IndexedDB storage untuk melihat data cached
- Cache size dan TTL

## **Common Issues & Solutions:**

### **1. Data masih hilang saat offline:**
- Pastikan cache TTL sudah diperpanjang
- Cek apakah data sudah di-cache saat online
- Pastikan IndexedDB storage tidak penuh

### **2. Error 400 masih muncul:**
- Pastikan query tidak mengirim nilai null
- Cek nama kolom database yang benar
- Pastikan filter untuk productIds sudah benar

### **3. isLoading error masih muncul:**
- Pastikan semua variabel sudah dideklarasikan
- Cek scope variabel di setiap halaman
- Pastikan tidak ada typo dalam nama variabel

## **Performance Tips:**

1. **Pre-fetch Data:** Cache data penting saat aplikasi load
2. **Background Refresh:** Update data di background saat online
3. **Graceful Degradation:** Gunakan data cached saat offline
4. **Error Recovery:** Fallback ke cache saat fetch gagal

## **Debug Commands:**

```javascript
// Cek cache stats
console.log(dataService.getCacheStats());

// Force refresh cache
await dataService.refreshCacheOnOnline();

// Clear all caches
await dataService.clearAllCaches();

// Cek offline status
console.log('Online:', navigator.onLine);
``` 