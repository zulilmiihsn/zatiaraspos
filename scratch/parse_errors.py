import sys
import io
import re
from collections import defaultdict

errors = defaultdict(list)
warnings = defaultdict(list)

file_path = sys.argv[1]

try:
    with io.open(file_path, 'r', encoding='utf-16le') as f:
        lines = f.readlines()
except Exception:
    with io.open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

current_file = None
for line in lines:
    clean_line = re.sub(r'\x1b\[.*?m', '', line).strip()
    if clean_line.startswith('d:\\'):
        parts = clean_line.split(':')
        if len(parts) >= 2:
            current_file = parts[0] + ':' + parts[1]
    elif clean_line.startswith('Error:'):
        if current_file: errors[current_file].append(clean_line)
    elif clean_line.startswith('Warn:'):
        if current_file: warnings[current_file].append(clean_line)

for f in errors:
    print(f"--- {f} ---")
    for e in set(errors[f]):
        print(e)
    print("")

print("WARNINGS COUNT:")
for f in warnings:
    print(f"{f}: {len(warnings[f])} warnings")
