import os
import re

files_to_fix = [
    'src/routes/pengaturan/pemilik/riwayat/+page.svelte',
    'src/routes/pengaturan/pemilik/manajemenmenu/+page.svelte',
    'src/routes/pengaturan/pemilik/gantikeamanan/+page.svelte',
    'src/routes/pengaturan/pemilik/+page.svelte',
    'src/routes/pengaturan/kasir/riwayat/+page.svelte',
    'src/routes/pengaturan/+page.svelte',
    'src/routes/laporan/+page.svelte',
    'src/routes/catat/+page.svelte',
    'src/routes/+page.svelte'
]

def fix_file(path):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # 1. userRole.subscribe((role) => { ... })();
    # This was a pattern for checking auth once.
    if "userRole.subscribe((role) => {" in content:
        # replace block
        content = re.sub(
            r'userRole\.subscribe\(\(role\)\s*=>\s*\{([^}]+)\}\)\(\);',
            r"const role = userRole.value;\n\t\t\t{\1}",
            content
        )
        changed = True

    # 2. storeGet(userRole)
    if "storeGet(userRole)" in content:
        content = content.replace("storeGet(userRole)", "userRole.value")
        changed = True

    # 3. let currentUserRole = ''; \n userRole.subscribe((val) => (currentUserRole = val || ''));
    # Or const unsubscribe = userRole.subscribe(...)
    p1 = r'const unsubscribeRole = userRole\.subscribe\(\(val\)\s*=>\s*\(currentUserRole = val \|\| \'\'\)\);'
    if re.search(p1, content):
        content = re.sub(p1, "$: currentUserRole = userRole.value || '';", content)
        changed = True
        
    p2 = r'const unsubscribe = userRole\.subscribe\(\(val\)\s*=>\s*\(currentUserRole = val \|\| \'\'\)\);'
    if re.search(p2, content):
        content = re.sub(p2, "$: currentUserRole = userRole.value || '';", content)
        changed = True

    p3 = r'userRole\.subscribe\(\(val\)\s*=>\s*\(currentUserRole = val \|\| \'\'\)\);'
    if re.search(p3, content):
        content = re.sub(p3, "$: currentUserRole = userRole.value || '';", content)
        changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated", path)

for p in files_to_fix:
    fix_file(p)
