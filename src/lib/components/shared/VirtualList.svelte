<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  export let items: any[] = [];
  export let itemHeight: number = 80;
  export let containerHeight: number = 400;
  export let overscan: number = 5;
  
  let container: HTMLElement;
  let scrollTop = 0;
  let containerRect: DOMRect;
  
  $: visibleCount = Math.ceil(containerHeight / itemHeight) + overscan;
  $: startIndex = Math.floor(scrollTop / itemHeight);
  $: endIndex = Math.min(startIndex + visibleCount, items.length);
  $: visibleItems = items.slice(startIndex, endIndex);
  $: totalHeight = items.length * itemHeight;
  $: offsetY = startIndex * itemHeight;
  
  function handleScroll() {
    if (container) {
      scrollTop = container.scrollTop;
    }
  }
  
  onMount(() => {
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      containerRect = container.getBoundingClientRect();
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
  class="overflow-auto"
  style="height: {containerHeight}px;"
>
  <div style="height: {totalHeight}px; position: relative;">
    <div style="transform: translateY({offsetY}px);">
      {#each visibleItems as item, index (item.id || index)}
        <div style="height: {itemHeight}px;">
          <slot {item} {index} />
        </div>
      {/each}
    </div>
  </div>
</div> 