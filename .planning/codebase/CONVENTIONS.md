# 🏗️ ZatiarasPOS — CONVENTIONS.md (Coding Standards)

## ✅ Svelte 5 Runes — WAJIB

```svelte
<!-- ✅ BENAR -->
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log('count changed:', count);
  });

  let { title, onClose }: { title: string; onClose: () => void } = $props();
</script>

<!-- ❌ SALAH — Svelte 4 pattern, jangan pakai -->
<script lang="ts">
  import { writable } from 'svelte/store';
  export let title: string;
  $: doubled = count * 2;
</script>
```

## ✅ TypeScript — Strict

```typescript
// ✅ BENAR — explicit types
async function getProducts(branchId: string): Promise<Product[]> { ... }

// ❌ SALAH — any tanpa alasan
async function getData(id: any): Promise<any> { ... }
```

## ✅ Naming Conventions

- **Files**: `camelCase.ts`, `PascalCase.svelte`
- **Components**: PascalCase (`BottomNav.svelte`)
- **Functions**: camelCase (`getProducts`)
- **Types/Interfaces**: PascalCase (`UserRole`, `ProductType`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **CSS classes**: Tailwind utilities (tidak ada custom class kecuali terpaksa)

## ✅ Import Pattern

```typescript
// Selalu import types dari barrel file
import type { Product, UserRole, Transaction } from '$lib/types';

// Services dari path langsung
import { dataService } from '$lib/services/dataService';

// Stores
import { userRole } from '$lib/stores/userRole';
```

## ✅ Error Handling

```typescript
// ✅ Selalu handle error dengan graceful fallback
try {
	const data = await dataService.getProducts(branchId);
	return data;
} catch (error) {
	console.error('[getProducts]', error);
	return []; // fallback kosong, jangan crash
}
```

## ✅ Supabase Query Pattern

```typescript
// ✅ Selalu destructure error
const { data, error } = await supabase.from('products').select('*');
if (error) throw new Error(error.message);
return data;
```

## ✅ UI/UX Rules

- **Jangan ubah UI yang ada** kecuali diminta eksplisit
- Semua animasi pakai Svelte transitions (`fade`, `slide`, `scale`)
- Toast/notifikasi pakai komponen `toastNotification.svelte` yang sudah ada
- Modal pakai komponen `modalSheet.svelte` atau `dropdownSheet.svelte`
- Icon pakai `lucide-svelte` (jangan tambah icon library lain)
