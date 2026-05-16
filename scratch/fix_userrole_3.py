import os
import re

def rep(path, old, new):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    if old in c:
        c = c.replace(old, new)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        print("Updated", path)

def rep_regex(path, pat, new):
    if not os.path.exists(path): return
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    if re.search(pat, c):
        c = re.sub(pat, new, c)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(c)
        print("Updated regex", path)


# 1. Dashboard +page.svelte
rep_regex('src/routes/+page.svelte',
    r'const unsubscribeProfile = userProfile\.subscribe\(\(val\) => \(userProfileData = val\)\);\n\s*return \(\) => \{\n\s*unsubscribeRole\(\);\n\s*unsubscribeProfile\(\);\n\s*\};',
    "$: userProfileData = userProfile.value;"
)
rep_regex('src/routes/+page.svelte',
    r'const unsubscribeProfile = userProfile\.subscribe\(\(val\) => \(userProfileData = val\)\);',
    "$: userProfileData = userProfile.value;"
)
rep('src/routes/+page.svelte', 'unsubscribeRole();', '')
rep('src/routes/+page.svelte', 'unsubscribeProfile();', '')


# 2. catat/+page.svelte
rep('src/routes/catat/+page.svelte', 'return unsubscribe;', '')

# 3. laporan/+page.svelte
rep('src/routes/laporan/+page.svelte', 'userProfile.subscribe((val) => (userProfileData = val));', '$: userProfileData = userProfile.value;')

# 4. kasir riwayat
rep_regex('src/routes/pengaturan/kasir/riwayat/+page.svelte',
    r'userRole\.subscribe\(\(role\) => \{\n\s*if \(role !== \'kasir\'\) \{\n\s*goto\(\'/unauthorized\'\);\n\s*\}\n\s*\}\)\(\);',
    r"if (userRole.value !== 'kasir') {\n\t\t\tgoto('/unauthorized');\n\t\t}"
)

# 5. pemilik riwayat, pemilik page, gantikeamanan
pat = r'userRole\.subscribe\(\(role\) => \{\n\s*if \(role !== \'pemilik\' && role !== \'admin\'\) \{\n\s*goto\(\'/unauthorized\'\);\n\s*\}\n\s*\}\)\(\);'
new_code = r"if (userRole.value !== 'pemilik' && userRole.value !== 'admin') {\n\t\t\tgoto('/unauthorized');\n\t\t}"

rep_regex('src/routes/pengaturan/pemilik/riwayat/+page.svelte', pat, new_code)
rep_regex('src/routes/pengaturan/pemilik/gantikeamanan/+page.svelte', pat, new_code)
rep_regex('src/routes/pengaturan/pemilik/+page.svelte', pat, new_code)

