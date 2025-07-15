Iy<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createVirtualScroller } from '$lib/utils/performance';

  export let items: any[] = [];
  export let itemHeight: number = 60;
  export let containerHeight: number = 400;
  export let renderItem: (item: any, index: number) => string;

  let container: HTMLElement;
  let scrollTop = 0;
  let virtualScroller: any;

  $: if (items && container) {
    virtualScroller = createVirtualScroller(items, itemHeight, containerHeight, scrollTop);
  }

  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    scrollTop = target.scrollTop;
  }

  onMount(() => {
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
  });

  onDestroy(() => {
    if (container) {
      container.removeEventListener('scroll', handleScroll);
    }
  });
</script>

<div 
  bind:this={container}
  class="virtual-list-container"
  style="height: {containerHeight}px; overflow-y: auto;"
>
  <div 
    class="virtual-list-content"
    style="height: {items.length * itemHeight}px; position: relative;"
  >
    {#if virtualScroller}
      {#each virtualScroller.visibleItems as item, index}
        <div 
          class="virtual-list-item"
          style="
            position: absolute;
            top: {(virtualScroller.startIndex + index) * itemHeight}px;
            height: {itemHeight}px;
            width: 100%;
          "
        >
          {@html renderItem(item, virtualScroller.startIndex + index)}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .virtual-list-container {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }

  .virtual-list-item {
    padding: 12px;
    border-bottom: 1px solid #f3f4f6;
  }

  .virtual-list-item:last-child {
    border-bottom: none;
  }
</style> 