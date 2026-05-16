import re
import sys

for file in ['src/routes/pos/+page.svelte']:
    sys.stdout.buffer.write(f"--- {file} ---\n".encode('utf-8'))
    with open(file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if '$:' in line:
            sys.stdout.buffer.write(f"{i+1}: {line.strip()}\n".encode('utf-8'))
