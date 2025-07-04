<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  export let open = false;
  export let title = '';
  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  // Optional: close modal dengan swipe ke bawah (mobile UX)
  let startY = 0;
  let currentY = 0;
  let sheet: HTMLDivElement;
  let dragging = false;
  let allowDrag = false;
  let scrollable: HTMLDivElement;

  function onTouchStart(e: TouchEvent) {
    // Cek apakah gesture dimulai dari dragbar/header SAJA
    const target = e.target as HTMLElement;
    if (target.classList.contains('sheet-dragbar') || target.classList.contains('sheet-header')) {
      allowDrag = true;
    } else {
      allowDrag = false;
    }
    if (allowDrag) {
      dragging = true;
      startY = e.touches[0].clientY;
    }
  }
  function onTouchMove(e: TouchEvent) {
    if (!dragging || !allowDrag) return;
    currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0 && sheet) {
      sheet.style.transform = `translateY(${diff}px)`;
    }
  }
  function onTouchEnd() {
    if (!allowDrag) return;
    dragging = false;
    // Pastikan swipe-to-close hanya saat swipe ke bawah (drag turun)
    if (currentY - startY > 80) {
      close();
    } else if (sheet) {
      sheet.style.transform = '';
    }
    allowDrag = false;
  }
</script>

<style>
.modal-backdrop {
  position: fixed;
  left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0,0,0,0.18);
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transition: background 0.2s;
}
.modal-sheet {
  position: relative;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: #fff;
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -2px 16px rgba(0,0,0,0.08);
  min-height: 120px;
  animation: slideUp 0.22s cubic-bezier(.4,1.4,.6,1) 1;
  will-change: transform;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  height: 92vh;
}
@media (min-width: 768px) {
  .modal-sheet {
    max-width: 700px;
    height: 90vh;
    max-height: 90vh;
  }
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.sheet-header {
  padding: 1.1rem 1.2rem 0.5rem 1.2rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  text-align: center;
  position: relative;
}
.sheet-close {
  position: absolute;
  right: 1.2rem;
  top: 1.1rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #aaa;
  cursor: pointer;
}
.sheet-dragbar {
  width: 38px;
  height: 5px;
  background: #e0e0e0;
  border-radius: 3px;
  margin: 0.5rem auto 0.7rem auto;
}
.sheet-content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding-bottom: 1rem;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}
.sheet-content::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}
</style>

{#if open}
  <div class="modal-backdrop" on:click|self={close}>
    <div
      class="modal-sheet w-full max-w-[100vw] overflow-x-hidden px-0 sm:px-0 pt-2 pb-0"
      style="max-width:100vw;"
      bind:this={sheet}
      on:touchstart={onTouchStart}
      on:touchmove={onTouchMove}
      on:touchend={onTouchEnd}
      on:click|stopPropagation
    >
      <div class="sheet-dragbar"></div>
      <div class="sheet-header">
        {title}
      </div>
      <div class="sheet-content flex-1 min-h-0 overflow-y-auto px-4 sm:px-6" bind:this={scrollable}>
        <slot />
      </div>
      <div class="sheet-footer absolute left-0 right-0 bottom-0 w-full max-w-[100vw] px-4 sm:px-6 pt-3 pb-4 bg-white shadow-[0_-2px_16px_rgba(0,0,0,0.08)] z-20">
        <slot name="footer" />
      </div>
    </div>
  </div>
{/if} 