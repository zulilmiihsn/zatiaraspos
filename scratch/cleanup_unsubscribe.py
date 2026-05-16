import os
import re

for root, dirs, files in os.walk('src'):
    for file in files:
        if not file.endswith('.svelte'): continue
        path = os.path.join(root, file)
        with open(path, 'r', encoding='utf-8') as f:
            c = f.read()

        changed = False

        if re.search(r'let\s+unsubscribeBranch[^;]*;', c):
            c = re.sub(r'let\s+unsubscribeBranch[^;]*;\n?', '', c)
            changed = True

        if re.search(r'if\s*\(\s*unsubscribeBranch\s*\)\s*unsubscribeBranch\(\);', c):
            c = re.sub(r'\s*if\s*\(\s*unsubscribeBranch\s*\)\s*unsubscribeBranch\(\);', '', c)
            changed = True

        if re.search(r'unsubscribeBranch\(\);', c):
            c = re.sub(r'\s*unsubscribeBranch\(\);', '', c)
            changed = True

        if 'import { storeGet } from' in c and 'storeGet(' not in c:
            c = re.sub(r'import\s*\{\s*storeGet\s*\}\s*from\s*[^;]+;\n?', '', c)
            changed = True

        if changed:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(c)
            print("Cleaned up", path)
