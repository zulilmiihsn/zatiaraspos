import os
import re

files_with_subscribe = [
    'src/routes/pos/+page.svelte',
    'src/routes/pengaturan/pemilik/manajemenmenu/+page.svelte',
    'src/routes/laporan/+page.svelte',
    'src/routes/+page.svelte'
]

for p in files_with_subscribe:
    if not os.path.exists(p): continue
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    
    changed = False

    # For pos, manajemenmenu, laporan
    pat1 = r'unsubscribeBranch\s*=\s*selectedBranch\.subscribe\(\s*\(\)\s*=>\s*\{([^\}]+)\}\s*\);'
    if re.search(pat1, c):
        # We replace this with a reactive block
        # Since it depends on selectedBranch.value, we inject a dummy read to trigger it
        rep1 = r'$: {\n\t\tlet _branch = selectedBranch.value;\n\t\t\1\n\t}'
        c = re.sub(pat1, rep1, c)
        changed = True
        
    pat1_arg = r'unsubscribeBranch\s*=\s*selectedBranch\.subscribe\(\s*\([^)]*\)\s*=>\s*\{([^\}]+)\}\s*\);'
    if re.search(pat1_arg, c):
        rep1_arg = r'$: {\n\t\tlet _branch = selectedBranch.value;\n\t\t\1\n\t}'
        c = re.sub(pat1_arg, rep1_arg, c)
        changed = True

    pat2 = r'const unsubscribe\s*=\s*selectedBranch\.subscribe\(async\s*\([^)]*\)\s*=>\s*\{([^\}]+)\}\s*\);'
    if re.search(pat2, c):
        rep2 = r'$: (async () => {\n\t\tlet _branch = selectedBranch.value;\n\t\t\1\n\t})();'
        c = re.sub(pat2, rep2, c)
        changed = True

    # Remove `unsubscribeBranch();` or `unsubscribe();` from onDestroy
    c = c.replace('if (unsubscribeBranch) unsubscribeBranch();', '')
    c = c.replace('unsubscribeBranch();', '')
    c = c.replace('unsubscribe();', '')
    # Remove `let unsubscribeBranch: any;`
    c = re.sub(r'let unsubscribeBranch[^;]*;', '', c)

    if changed:
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print("Fixed subscribe in", p)
