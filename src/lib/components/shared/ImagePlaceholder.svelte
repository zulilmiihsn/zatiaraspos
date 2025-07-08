<script lang="ts">
  import { onMount } from 'svelte';
  
  export let size: number = 72;
  export let icon: string = '🍹'; // emoji jus buah
  export let src = '';
  export let alt = '';
  export let width = 100;
  export let height = 100;
  export let className = '';
  
  let imgElement;
  let isLoaded = false;
  let isInView = false;
  
  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            isInView = true;
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    if (imgElement) {
      observer.observe(imgElement);
    }
    
    return () => {
      if (imgElement) {
        observer.unobserve(imgElement);
      }
    };
  });
  
  function handleLoad() {
    isLoaded = true;
  }
</script>

<style>
.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #ff5fa2;
  font-size: 2.5rem;
  width: var(--size, 72px);
  height: var(--size, 72px);
  user-select: none;
}
</style>

<div
  class="placeholder bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50"
  style="--size: {size}px;"
  aria-label="Gambar belum tersedia"
>
  {icon}
</div>

<div 
  bind:this={imgElement}
  class="relative overflow-hidden {className}"
  style="width: {width}px; height: {height}px;"
>
  {#if !isLoaded}
    <div class="absolute inset-0 bg-gray-200 animate-pulse rounded-lg"></div>
  {/if}
  
  {#if isInView}
    <img
      {src}
      {alt}
      {width}
      {height}
      class="w-full h-full object-cover rounded-lg transition-opacity duration-300 {isLoaded ? 'opacity-100' : 'opacity-0'}"
      onload={handleLoad}
      loading="lazy"
    />
  {/if}
</div> 