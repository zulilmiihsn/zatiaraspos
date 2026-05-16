import os

files_to_fix = [
    'src/routes/pengaturan/pemilik/riwayat/+page.svelte',
    'src/routes/pengaturan/pemilik/gantikeamanan/+page.svelte',
    'src/routes/pengaturan/pemilik/+page.svelte'
]

for path in files_to_fix:
    if not os.path.exists(path): continue
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    
    old_code = "userRole.subscribe((role) => {\n\t\t\tif (role !== 'pemilik') {\n\t\t\t\tgoto('/unauthorized');\n\t\t\t}\n\t\t})();"
    new_code = "if (userRole.value !== 'pemilik') {\n\t\t\tgoto('/unauthorized');\n\t\t}"
    
    if old_code in c:
        c = c.replace(old_code, new_code)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        print("Fixed", path)

