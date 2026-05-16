import io
try:
    with io.open('scratch/svelte_check.txt', 'r', encoding='utf-16le') as f:
        print(''.join(f.readlines()[:50]))
except Exception:
    with io.open('scratch/svelte_check.txt', 'r', encoding='utf-8') as f:
        print(''.join(f.readlines()[:50]))
