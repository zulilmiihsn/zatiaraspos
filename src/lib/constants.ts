import Home from 'lucide-svelte/icons/home';
import ShoppingBag from 'lucide-svelte/icons/shopping-bag';
import FileText from 'lucide-svelte/icons/file-text';
import Book from 'lucide-svelte/icons/book';

export const NAV_ITEMS = [
  { label: 'Beranda', icon: Home, path: '/' },
  { label: 'Kasir', icon: ShoppingBag, path: '/pos' },
  { label: 'Catat', icon: Book, path: '/catat' },
  { label: 'Laporan', icon: FileText, path: '/laporan' },
];
