import sys
with open('src/routes/laporan/+page.svelte', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'showAiModal' in line or 'isAiLoading' in line or 'aiAnswer' in line or 'aiQuestion' in line:
            sys.stdout.buffer.write(f"{i+1}: {line.strip()}\n".encode('utf-8'))
