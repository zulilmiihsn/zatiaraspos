import os
import re

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # Replace import
    if re.search(r"from ['\"]\$lib/stores/userRole['\"]", content):
        content = re.sub(r"from ['\"]\$lib/stores/userRole['\"]", "from '$lib/stores/userRole.svelte'", content)
        changed = True

    # Replace currentUserRole subscription
    pattern1 = r"let currentUserRole[^;]*;\s*(?:const\s+[^\s]+\s*=\s*)?userRole\.subscribe\(([^)]+)\)\s*(?:=>\s*\([^)]*\))?[^;]*;"
    if re.search(pattern1, content):
        content = re.sub(pattern1, "let currentUserRole = '';\n\t$: currentUserRole = userRole.value || '';", content)
        changed = True

    # Replace any simple userRole.subscribe((role) => {
    # wait, this one is multiline. Let's not do it with regex and do it manually.
    
    # Replace $userRole
    if "$userRole" in content:
        content = content.replace("$userRole", "userRole.value")
        changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Updated', path)

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.svelte') or file.endswith('.ts'):
            # Skip the store file itself
            if 'userRole.svelte.ts' in file or 'userRole.ts' in file:
                continue
            process_file(os.path.join(root, file))
