<script lang="ts">
import Settings from 'lucide-svelte/icons/settings';
import { goto } from '$app/navigation';
export let showSettings: boolean = true;
export let onSettings: (() => void) | undefined;
</script>

<style>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1rem 0.7rem 1rem;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}
.logo-app {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(255,95,162,0.07);
  background: #fff;
}
.settings-btn {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #fff;
  border: 1.5px solid #eee;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.45rem;
  color: #ff5fa2;
  box-shadow: 0 2px 8px rgba(255,95,162,0.07);
  cursor: pointer;
  transition: border 0.15s, box-shadow 0.15s;
}
.settings-btn:active {
  border-color: #ff5fa2;
  box-shadow: 0 4px 16px rgba(255,95,162,0.12);
}
.topbar-center {
  flex: 1;
  text-align: center;
  font-size: 1.08rem;
  font-weight: 500;
  color: #333;
  letter-spacing: 0.01em;
}
</style>

<div class="topbar">
  <img class="logo-app" src="/img/logo.svg" alt="Logo Zatiaras" />
  <div class="topbar-center">
    <slot />
  </div>
  {#if showSettings}
    <button class="settings-btn" aria-label="Pengaturan" on:click={onSettings ?? (() => goto('/pengaturan'))}>
      <Settings size={22} />
    </button>
  {:else}
    <div style="width:38px;height:38px;"></div>
  {/if}
</div> 