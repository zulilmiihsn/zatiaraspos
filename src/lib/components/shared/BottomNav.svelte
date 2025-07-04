<script lang="ts">
import Home from 'lucide-svelte/icons/home';
import ShoppingBag from 'lucide-svelte/icons/shopping-bag';
import FileText from 'lucide-svelte/icons/file-text';
import Book from 'lucide-svelte/icons/book';
import { goto } from '$app/navigation';
import { page } from '$app/stores';

const navs = [
  { label: 'Beranda', icon: Home, path: '/' },
  { label: 'Kasir', icon: ShoppingBag, path: '/pos' },
  { label: 'Catat', icon: Book, path: '/catat' },
  { label: 'Laporan', icon: FileText, path: '/laporan' },
];

let indicatorLeft = 0;
let indicatorWidth = 0;
let navRefs = [];

$: {
  const idx = navs.findIndex(n =>
    n.path === '/' ? $page.url.pathname === '/' : ($page.url.pathname === n.path || $page.url.pathname.startsWith(n.path + '/'))
  );
  if (navRefs[idx]) {
    const rect = navRefs[idx].getBoundingClientRect();
    const parentRect = navRefs[0]?.parentElement?.getBoundingClientRect();
    indicatorLeft = rect.left - (parentRect?.left || 0);
    indicatorWidth = rect.width;
  }
}
</script>

<style>
.bottom-nav {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: 58px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 10;
  border-radius: 4px 4px 0 0;
  box-shadow: 0 -6px 24px -6px rgba(51,51,51,0.10);
  padding: 0 2px;
  overflow: hidden;
}
.bottom-nav-btn {
  flex: 1;
  text-align: center;
  color: #ff5fa2;
  font-size: 0.92rem;
  font-weight: 400;
  padding: 0.3rem 0 0.1rem 0;
  border: none;
  background: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.05rem;
  transition: color 0.22s cubic-bezier(.4,0,.2,1);
  min-width: 0;
  position: relative;
  z-index: 1;
}
.bottom-nav-btn svg {
  display: block;
  margin-bottom: 0.1rem;
  width: 24px;
  height: 24px;
  stroke-width: 2.1;
  transition: color 0.22s cubic-bezier(.4,0,.2,1);
}
.bottom-nav-btn.active {
  color: #e94e8f;
}
.bottom-nav-btn:not(.active) {
  color: #ffb3d1;
}
.nav-indicator {
  position: absolute;
  bottom: 0;
  height: 3px;
  border-radius: 2px 2px 0 0;
  background: #e94e8f;
  transition: left 0.28s cubic-bezier(.4,0,.2,1), width 0.28s cubic-bezier(.4,0,.2,1);
  z-index: 2;
}
</style>

<nav class="bottom-nav" style="position:relative;">
  {#each navs as nav, i}
    <button
      class="bottom-nav-btn {nav.path === '/' ? ($page.url.pathname === '/' ? 'active' : '') : (($page.url.pathname === nav.path || $page.url.pathname.startsWith(nav.path + '/')) ? 'active' : '')}"
      aria-label={nav.label}
      bind:this={navRefs[i]}
      on:click={() => goto(nav.path)}
    >
      <svelte:component this={nav.icon} size={22} />
      {nav.label}
    </button>
  {/each}
  <div class="nav-indicator" style="left:{indicatorLeft}px; width:{indicatorWidth}px;"></div>
</nav> 