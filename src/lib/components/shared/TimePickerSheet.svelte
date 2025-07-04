<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  export let value = '';
  export let open = false;
  const dispatch = createEventDispatcher();
  let selected = '';
  let now = '';
  onMount(() => {
    const d = new Date();
    now = d.toTimeString().slice(0, 5);
    selected = value || now;
  });
  $: if (open && !selected) selected = now;
  function close() { dispatch('close'); }
  function confirm() { dispatch('select', selected); close(); }
</script>

{#if open}
  <div class="modal-backdrop" on:click={close}>
    <div class="sheet" on:click|stopPropagation>
      <div class="sheet-header">Pilih Waktu</div>
      <div class="relative">
        <input type="time" class="time-input pr-10" bind:value={selected} />
        <span class="icon-clock absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="#ff5fa2" stroke-width="1.5" fill="#fff"/><path d="M12 7v5l3 3" stroke="#ff5fa2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
      <button class="sheet-btn" on:click={confirm}>Pilih</button>
    </div>
  </div>
{/if}

<style>
.modal-backdrop {
  position: fixed; left: 0; right: 0; top: 0; bottom: 0;
  background: rgba(0,0,0,0.18); z-index: 100;
  display: flex; align-items: flex-end; justify-content: center;
}
.sheet {
  width: 100%; max-width: 420px; margin: 0 auto;
  background: #fff; border-radius: 18px 18px 0 0;
  box-shadow: 0 -2px 16px rgba(0,0,0,0.08);
  min-height: 120px; padding: 2rem 1.5rem 1.5rem 1.5rem;
  display: flex; flex-direction: column; gap: 1.2rem;
  animation: slideUp 0.22s cubic-bezier(.4,1.4,.6,1) 1;
}
@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.sheet-header {
  font-size: 1.15rem; font-weight: 600; color: #ff5fa2; text-align: center;
}
.time-input {
  width: 100%; font-size: 1.15rem; border: 1.5px solid #f3c6db; border-radius: 10px;
  padding: 0.7rem 1rem; color: #333; outline: none; transition: border 0.18s;
}
.time-input:focus { border-color: #ff5fa2; box-shadow: 0 0 0 2px #ffe4f1; }
.sheet-btn {
  width: 100%; background: #ff5fa2; color: #fff; font-weight: bold; font-size: 1.08rem;
  border: none; border-radius: 12px; padding: 0.95rem 0; box-shadow: 0 2px 8px rgba(255,95,162,0.10);
  transition: background 0.18s;
}
.sheet-btn:active, .sheet-btn:hover { background: #e94e8f; }
.relative { position: relative; }
.icon-clock { display: flex; align-items: center; }
.pr-10 { padding-right: 2.5rem; }
</style> 