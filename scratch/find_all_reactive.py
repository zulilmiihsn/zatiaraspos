import os
import sys

for root, _, files in os.walk('src/routes'):
    for file in files:
        if file.endswith('.svelte'):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f):
                        if '$:' in line:
                            sys.stdout.buffer.write(f"{path}:{i+1}: {line.strip()}\n".encode('utf-8'))
            except Exception as e:
                pass
