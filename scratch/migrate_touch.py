import re

def migrate_touch(file_path, current_index):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add imports
    if 'from \'$lib/utils/touchNavigation\'' not in content:
        content = content.replace('import { browser } from \'$app/environment\';',
                                  'import { browser } from \'$app/environment\';\n\timport { createSwipeNavigation } from \'$lib/utils/touchNavigation\';\n\timport { NAV_ITEMS, getNavIndex } from \'$lib/constants/navigation\';')
        
        # Or if import browser is missing:
        if 'import { createSwipeNavigation }' not in content:
             content = content.replace('<script lang="ts">',
                                  '<script lang="ts">\n\timport { createSwipeNavigation } from \'$lib/utils/touchNavigation\';\n\timport { NAV_ITEMS, getNavIndex } from \'$lib/constants/navigation\';')

    # Remove `const navs = [...]`
    content = re.sub(r'const navs = \[\s*\{ name: \'Beranda\'.*?\{ name: \'Pengaturan\'.*?\};\n', '', content, flags=re.DOTALL)
    
    # Remove touch variables
    touch_vars = r'let touchStartX = 0;.*?let isSwiping = false;\n'
    content = re.sub(touch_vars, '', content, flags=re.DOTALL)
    
    # Remove browser check for touch
    browser_check = r'if \(browser\) \{\s*isTouchDevice = \'ontouchstart\' in window \|\| navigator\.maxTouchPoints > 0;\s*\}\n'
    content = re.sub(browser_check, '', content, flags=re.DOTALL)

    # Remove functions: handleTouchStart, handleTouchMove, handleTouchEnd, handleGlobalClick
    for func in ['handleTouchStart', 'handleTouchMove', 'handleTouchEnd', 'handleGlobalClick']:
        func_regex = rf'function {func}\(.*?\)\s*{{.*?}}\n'
        content = re.sub(func_regex, '', content, flags=re.DOTALL) # this might not match properly if nested blocks exist.

    # Inject destructuring
    destructure = f'\n\tconst {{ handleTouchStart, handleTouchMove, handleTouchEnd, handleGlobalClick }} = createSwipeNavigation({current_index});\n'
    
    # Add after script opening or imports
    if 'createSwipeNavigation' in content and 'const { handleTouchStart' not in content:
         content = content.replace('import { NAV_ITEMS, getNavIndex } from \'$lib/constants/navigation\';',
                                   f'import {{ NAV_ITEMS, getNavIndex }} from \'$lib/constants/navigation\';\n{destructure}')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

migrate_touch('src/routes/+page.svelte', 0)
migrate_touch('src/routes/pos/+page.svelte', 1)
migrate_touch('src/routes/catat/+page.svelte', 2)
