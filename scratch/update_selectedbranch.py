import os
import re

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    if re.search(r"from ['\"]\$lib/stores/selectedBranch['\"]", content):
        content = re.sub(r"from ['\"]\$lib/stores/selectedBranch['\"]", "from '$lib/stores/selectedBranch.svelte'", content)
        changed = True

    if "storeGet(selectedBranch)" in content:
        content = content.replace("storeGet(selectedBranch)", "selectedBranch.value")
        changed = True

    # Specifically for pos/+page.svelte and pengaturan/pemilik/manajemenmenu/+page.svelte
    # They both have: unsubscribeBranch = selectedBranch.subscribe(() => {
    # We will manually fix those files because the logic is complex, or we can just replace the block.

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print('Updated', path)

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.svelte') or file.endswith('.ts'):
            if 'selectedBranch.svelte.ts' in file or 'selectedBranch.ts' in file:
                continue
            process_file(os.path.join(root, file))
