import os
import re

files_to_edit = [
    r'd:\kulyeah\project\zatiaraspos\src\routes\pengaturan\pemilik\riwayat\+page.svelte',
    r'd:\kulyeah\project\zatiaraspos\src\routes\pengaturan\kasir\riwayat\+page.svelte',
    r'd:\kulyeah\project\zatiaraspos\src\routes\laporan\+page.svelte',
    r'd:\kulyeah\project\zatiaraspos\src\lib\services\autoApplyService.ts',
    r'd:\kulyeah\project\zatiaraspos\src\lib\components\shared\topBar.svelte',
    r'd:\kulyeah\project\zatiaraspos\src\lib\components\shared\aiChatModal.svelte'
]

def add_import(content):
    if "import { refreshBus } from '$lib/utils/refreshBus';" not in content:
        content = re.sub(r'(<script[^>]*>)', r'\1\n\timport { refreshBus } from \'$lib/utils/refreshBus\';', content, 1)
        # For .ts files
        if "<script" not in content:
            content = "import { refreshBus } from '$lib/utils/refreshBus';\n" + content
    return content

for file_path in files_to_edit:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    orig_content = content
    
    if file_path.endswith('.svelte'):
        content = add_import(content)
    elif file_path.endswith('.ts'):
        content = add_import(content)
    
    # 1. autoApplyService, topBar, aiChatModal (Emit calls)
    # Replace check and call with emit
    content = re.sub(
        r'if\s*\(\s*typeof\s*\(window\s+as\s+any\)\.__refreshLaporan\s*===\s*[\'"]function[\'"]\s*\)\s*\{\s*(?:await\s*)?\(window\s+as\s+any\)\.__refreshLaporan\(\);\s*\}',
        r'refreshBus.emit(\'laporan\');',
        content
    )
    content = re.sub(
        r'if\s*\(\s*typeof\s*\(window\s+as\s+any\)\.__refreshRiwayat\s*===\s*[\'"]function[\'"]\s*\)\s*\{\s*(?:await\s*)?\(window\s+as\s+any\)\.__refreshRiwayat\(\);\s*\}',
        r'refreshBus.emit(\'riwayat\');',
        content
    )
    content = re.sub(
        r'if\s*\(\s*typeof\s*\(window\s+as\s+any\)\.__refreshRiwayatKasir\s*===\s*[\'"]function[\'"]\s*\)\s*\{\s*(?:await\s*)?\(window\s+as\s+any\)\.__refreshRiwayatKasir\(\);\s*\}',
        r'refreshBus.emit(\'riwayatKasir\');',
        content
    )
    
    # 2. riwayat page (pemilik)
    if 'pemilik\\riwayat' in file_path:
        content = re.sub(
            r'let aiHandler: \(\) => Promise<void>;',
            r'let aiHandler: () => Promise<void>;\n\tlet offRiwayat: () => void;',
            content
        )
        content = re.sub(
            r'\(window\s+as\s+unknown\s+as\s+Record<string,\s+unknown>\)\.__refreshRiwayat\s*=\s*async\s*\(\)\s*=>\s*\{',
            r'offRiwayat = refreshBus.on(\'riwayat\', async () => {',
            content
        )
        content = re.sub(
            r'delete\s+\(window\s+as\s+unknown\s+as\s+Record<string,\s+unknown>\)\.__refreshRiwayat;',
            r'if (offRiwayat) offRiwayat();',
            content
        )

    # 3. riwayat page (kasir)
    if 'kasir\\riwayat' in file_path:
        content = re.sub(
            r'let intervalId: ReturnType<typeof setInterval>;',
            r'let intervalId: ReturnType<typeof setInterval>;\n\tlet offRiwayatKasir: () => void;',
            content
        )
        content = re.sub(
            r'\(window\s+as\s+unknown\s+as\s+Record<string,\s+unknown>\)\.__refreshRiwayatKasir\s*=\s*async\s*\(\)\s*=>\s*\{',
            r'offRiwayatKasir = refreshBus.on(\'riwayatKasir\', async () => {',
            content
        )
        content = re.sub(
            r'delete\s+\(window\s+as\s+unknown\s+as\s+Record<string,\s+unknown>\)\.__refreshRiwayatKasir;',
            r'if (offRiwayatKasir) offRiwayatKasir();',
            content
        )

    # 4. laporan page
    if 'laporan\\+page.svelte' in file_path:
        content = re.sub(
            r'let selectedDate:',
            r'let offLaporan: () => void;\n\tlet selectedDate:',
            content
        )
        content = re.sub(
            r'\(window\s+as\s+any\)\.__refreshLaporan\s*=\s*async\s*\(\)\s*=>\s*\{',
            r'offLaporan = refreshBus.on(\'laporan\', async () => {',
            content
        )
        content = re.sub(
            r'delete\s+\(window\s+as\s+any\)\.__refreshLaporan;',
            r'if (offLaporan) offLaporan();',
            content
        )

    if orig_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file_path}")
