import re
with open('src/routes/+layout.svelte', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'on:([a-z]+)', r'on\1', content)

with open('src/routes/+layout.svelte', 'w', encoding='utf-8') as f:
    f.write(content)
