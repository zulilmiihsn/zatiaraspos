<script lang="ts">
  import { onMount } from 'svelte';
  
  export let src: string;
  export let alt: string;
  export let width: number = 100;
  export let height: number = 100;
  export let placeholder: string = '🍹';
  export let className: string = '';
  
  let loaded = false;
  let error = false;
  let imageElement: HTMLImageElement;
  
  function handleLoad() {
    loaded = true;
  }
  
  function handleError() {
    error = true;
  }
  
  // Lazy loading dengan Intersection Observer
  onMount(() => {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && imageElement) {
            imageElement.src = src;
            observer.unobserve(imageElement);
          }
        });
      });
      
      if (imageElement) {
        observer.observe(imageElement);
      }
      
      return () => observer.disconnect();
    } else {
      // Fallback untuk browser lama
      if (imageElement) {
        imageElement.src = src;
      }
    }
  });
</script>

<div class="image-container {className}" style="width: {width}px; height: {height}px;">
  {#if !loaded && !error}
    <!-- Placeholder dengan skeleton loading -->
    <div class="placeholder bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 rounded-lg flex items-center justify-center text-2xl animate-pulse">
      {placeholder}
    </div>
  {:else if error}
    <!-- Error state -->
    <div class="placeholder bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
      {placeholder}
    </div>
  {/if}
  
  <img
    bind:this={imageElement}
    {alt}
    class="optimized-image {loaded ? 'loaded' : ''} {error ? 'hidden' : ''}"
    style="width: {width}px; height: {height}px; object-fit: cover; border-radius: 0.5rem;"
    onload={handleLoad}
    onerror={handleError}
  />
</div>

<style>
  .image-container {
    position: relative;
    overflow: hidden;
  }
  
  .placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  
  .optimized-image {
    transition: opacity 0.3s ease;
    opacity: 0;
  }
  
  .optimized-image.loaded {
    opacity: 1;
  }
  
  .optimized-image.hidden {
    display: none;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style> 