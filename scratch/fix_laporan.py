import os
import re

filepath = "src/routes/laporan/+page.svelte"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace $: var = ... -> let var = $derived(...)
content = re.sub(r'^\s*\$:\s*([a-zA-Z0-9_]+)\s*=\s*(.+?);$', r'\tlet \1 = $derived(\2);', content, flags=re.MULTILINE)

# Replace $: { ... } -> $effect(() => { ... })
content = re.sub(r'^\s*\$:\s*\{', r'\t$effect(() => {', content, flags=re.MULTILINE)
# The closing brace for $: { is just }, we might need to manually find it, but it's at line 440 maybe?
# Let's check the end of that block.
