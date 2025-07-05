<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  export let src: string = '';
  export let open: boolean = false;
  export let aspect: number = 1;
  const dispatch = createEventDispatcher();

  let canvasEl: HTMLCanvasElement;
  let img = new window.Image();
  let dragging = false;
  let startX = 0, startY = 0;
  let offset = { x: 0, y: 0 };
  let lastOffset = { x: 0, y: 0 };
  let zoom = 1;
  let minZoom = 1;
  let maxZoom = 4;
  let preview = '';
  const csize = 300;
  const cropSize = 240; // frame crop persegi di tengah

  $: if (src) {
    img.src = src;
    img.onload = () => {
      // Hitung minZoom agar gambar fit (bukan cover) di frame crop
      const scaleX = cropSize / img.width;
      const scaleY = cropSize / img.height;
      minZoom = Math.max(scaleX, scaleY);
      maxZoom = Math.max(4, minZoom * 2);
      zoom = minZoom;
      // Offset agar gambar tengah di frame crop
      offset.x = 0;
      offset.y = 0;
      lastOffset = { x: 0, y: 0 };
      preview = '';
      draw();
    };
  }

  function updatePreview() {
    // Perhitungan crop area yang benar
    const drawW = img.width * zoom;
    const drawH = img.height * zoom;
    // Rumus baru: posisi crop frame terhadap gambar
    const sx = ((csize - cropSize) / 2 - offset.x + (drawW - csize) / 2) / zoom;
    const sy = ((csize - cropSize) / 2 - offset.y + (drawH - csize) / 2) / zoom;
    const temp = document.createElement('canvas');
    temp.width = cropSize;
    temp.height = cropSize;
    const ctx = temp.getContext('2d');
    ctx.drawImage(img, sx, sy, cropSize / zoom, cropSize / zoom, 0, 0, cropSize, cropSize);
    preview = temp.toDataURL('image/jpeg', 0.92);
  }

  function draw() {
    if (!canvasEl || !img.complete) return;
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, csize, csize);
    // Hitung ukuran gambar setelah zoom
    const drawW = img.width * zoom;
    const drawH = img.height * zoom;
    // Pusatkan gambar di canvas + offset
    const centerX = csize / 2 + offset.x;
    const centerY = csize / 2 + offset.y;
    ctx.save();
    ctx.beginPath();
    ctx.rect((csize - cropSize) / 2, (csize - cropSize) / 2, cropSize, cropSize);
    ctx.clip();
    ctx.drawImage(
      img,
      centerX - drawW / 2,
      centerY - drawH / 2,
      drawW,
      drawH
    );
    ctx.restore();
    // Overlay gelap di luar area crop
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.rect(0, 0, csize, csize);
    ctx.rect((csize - cropSize) / 2, (csize - cropSize) / 2, cropSize, cropSize);
    ctx.fill('evenodd');
    ctx.restore();
    // Border crop
    ctx.strokeStyle = '#ff5fa2';
    ctx.lineWidth = 2;
    ctx.strokeRect((csize - cropSize) / 2, (csize - cropSize) / 2, cropSize, cropSize);
    updatePreview();
  }

  function getPointerPosition(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      return { x: e.clientX, y: e.clientY };
    }
  }
  function onPointerDown(e) {
    e.preventDefault();
    dragging = true;
    const pos = getPointerPosition(e);
    startX = pos.x;
    startY = pos.y;
    lastOffset = { ...offset };
  }
  function onPointerMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const pos = getPointerPosition(e);
    const dx = pos.x - startX;
    const dy = pos.y - startY;
    offset.x = lastOffset.x + dx;
    offset.y = lastOffset.y + dy;
    // Batasan agar cropper tidak keluar area crop
    const drawW = img.width * zoom;
    const drawH = img.height * zoom;
    const minX = (cropSize - drawW) / 2;
    const maxX = (drawW - cropSize) / 2;
    const minY = (cropSize - drawH) / 2;
    const maxY = (drawH - cropSize) / 2;
    offset.x = Math.max(-maxX, Math.min(offset.x, maxX));
    offset.y = Math.max(-maxY, Math.min(offset.y, maxY));
    draw();
  }
  function onPointerUp(e) {
    dragging = false;
  }
  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    zoom = Math.max(minZoom, Math.min(zoom + delta, maxZoom));
    draw();
  }
  function onZoomInput(e) {
    zoom = parseFloat(e.target.value);
    draw();
  }

  function handleOk() {
    // preview sudah selalu update, cukup dispatch
    dispatch('done', { cropped: preview });
  }
  function handleCancel() {
    dispatch('cancel');
  }
  onMount(() => draw());
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white rounded-2xl shadow-xl max-w-xs w-full p-4 flex flex-col items-center">
      <div class="w-full aspect-square relative bg-gray-100 rounded-xl overflow-hidden mb-4" style="height:300px;">
        <canvas bind:this={canvasEl} width={csize} height={csize}
          on:mousedown={onPointerDown}
          on:mousemove={onPointerMove}
          on:mouseup={onPointerUp}
          on:mouseleave={onPointerUp}
          on:touchstart={onPointerDown}
          on:touchmove={onPointerMove}
          on:touchend={onPointerUp}
          on:wheel={onWheel}
          style="width:100%;height:100%;touch-action:none;cursor:grab;"
        />
      </div>
      <input type="range" min={minZoom} max={maxZoom} step="0.01" bind:value={zoom} on:input={onZoomInput} class="w-full mb-2 accent-pink-500" />
      <div class="flex gap-2 w-full mt-2">
        <button class="flex-1 py-2 px-4 bg-pink-500 text-white rounded-xl font-bold hover:bg-pink-600 transition-colors text-base shadow-md" type="button" on:click={handleOk}>Gunakan</button>
        <button class="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-base" type="button" on:click={handleCancel}>Batal</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .aspect-square {
    aspect-ratio: 1 / 1;
  }
  input[type="range"].accent-pink-500::-webkit-slider-thumb {
    background: #ff5fa2;
  }
</style> 