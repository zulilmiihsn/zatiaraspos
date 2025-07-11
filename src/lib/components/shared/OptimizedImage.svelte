<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { createImageObserver } from '$lib/utils/performance';

  export let src: string;
  export let alt: string = '';
  export let width: number | string = 'auto';
  export let height: number | string = 'auto';
  export let class: string = '';
  export let loading: 'lazy' | 'eager' = 'lazy';
  export let placeholder: string = '🍽️';

  const dispatch = createEventDispatcher();

  let imgElement: HTMLImageElement;
  let isLoaded = false;
  let isInView = false;
  let hasError = false;
  let observer: IntersectionObserver;

  onMount(() => {
    if (loading === 'lazy') {
      observer = createImageObserver((entry) => {
        if (entry.isIntersecting) {
          isInView = true;
          observer?.disconnect();
        }
      });
      observer.observe(imgElement);
    } else {
      isInView = true;
    }

    return () => {
      observer?.disconnect();
    };
  });

  function handleLoad() {
    isLoaded = true;
    dispatch('load');
  }

  function handleError() {
    hasError = true;
    dispatch('error');
  }
</script>

<div 
  class="image-container {class}"
  style="width: {width}; height: {height};"
>
  {#if !isInView}
    <!-- Placeholder saat belum di viewport -->
    <div class="image-placeholder">
      <span class="placeholder-text">{placeholder}</span>
    </div>
  {:else if hasError}
    <!-- Fallback saat error -->
    <div class="image-error">
      <span class="error-text">{placeholder}</span>
    </div>
  {:else}
    <!-- Image yang sebenarnya -->
    <img
      bind:this={imgElement}
      {src}
      {alt}
      {loading}
      on:load={handleLoad}
      on:error={handleError}
      class="optimized-image"
      style="opacity: {isLoaded ? 1 : 0}; transition: opacity 0.3s ease;"
    />
    
    <!-- Loading placeholder -->
    {#if !isLoaded}
      <div class="image-loading">
        <span class="loading-text">{placeholder}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .image-container {
    position: relative;
    display: inline-block;
    overflow: hidden;
  }

  .image-placeholder,
  .image-error,
  .image-loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    color: #666;
    font-size: 1.5rem;
  }

  .optimized-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .placeholder-text,
  .error-text,
  .loading-text {
    font-size: 2rem;
    opacity: 0.7;
  }
</style> 