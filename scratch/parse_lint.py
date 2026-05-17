"""Parse lint output and group warnings by file and rule."""
import re
import sys
from collections import defaultdict

# Read the lint output file
with open(r"d:\kulyeah\project\zatiaraspos\.lint_full.txt", "r", encoding="utf-8") as f:
    content = f.read()

# Split into file sections
file_sections = re.split(r'\n(\S.*?\.(ts|svelte|js))\n', content)

results = defaultdict(lambda: defaultdict(list))
current_file = None

for i, section in enumerate(file_sections):
    if re.match(r'\S.*?\.(ts|svelte|js)$', section.strip()):
        current_file = section.strip()
        # Shorten path
        current_file = current_file.replace("D:\\kulyeah\\project\\zatiaraspos\\src\\", "")
        continue
    
    if current_file and section.strip():
        for line in section.split('\n'):
            m = re.match(r'\s+(\d+):(\d+)\s+warning\s+(.+?)\s{2,}(\S+)\s*$', line)
            if m:
                line_num, col, msg, rule = m.groups()
                # Extract variable name if present
                var_match = re.search(r"'(\w+)'", msg)
                var_name = var_match.group(1) if var_match else ""
                results[current_file][rule].append({
                    'line': int(line_num),
                    'col': int(col),
                    'var': var_name,
                    'msg': msg.strip()
                })

# Print summary per file
print("=" * 80)
print(f"{'FILE':<60} {'TOTAL':>5}")
print("=" * 80)

total = 0
for file in sorted(results.keys()):
    file_total = sum(len(v) for v in results[file].values())
    total += file_total
    print(f"{file:<60} {file_total:>5}")
    for rule in sorted(results[file].keys()):
        warnings = results[file][rule]
        vars_list = [w['var'] for w in warnings if w['var']]
        if vars_list:
            print(f"  {rule}: {len(warnings)} — {', '.join(vars_list)}")
        else:
            print(f"  {rule}: {len(warnings)}")

print("=" * 80)
print(f"{'TOTAL':<60} {total:>5}")
