<script lang="ts">
  export let size: number = 72;
  export let icon: string = '🍹'; // emoji jus buah
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