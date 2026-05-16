import sys
import io
import re
from collections import defaultdict

file_path = sys.argv[1]
target_file = sys.argv[2] if len(sys.argv) > 2 else None

try:
    with io.open(file_path, 'r', encoding='utf-16le') as f:
        lines = f.readlines()
except Exception:
    with io.open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

warnings_per_file = defaultdict(list)
current_file = None
pending_warn = None
for line in lines:
    clean = re.sub(r'\x1b\[.*?m', '', line).strip()
    if clean.startswith('d:\\'):
        parts = clean.split(':')
        if len(parts) >= 2:
            current_file = parts[0] + ':' + parts[1]
        pending_warn = None
    elif clean.startswith('Warn:'):
        pending_warn = clean
    elif pending_warn and clean.startswith('`') and current_file:
        # Next line after Warn: has the variable name in backticks
        varname = re.search(r'`(\w+)`', clean)
        if varname:
            warnings_per_file[current_file].append(varname.group(1))
        pending_warn = None
    elif pending_warn:
        # Try to extract from the warn line itself
        varname = re.search(r'`(\w+)` is updated', pending_warn)
        if varname and current_file:
            warnings_per_file[current_file].append(varname.group(1))
        pending_warn = None

# Also do a simpler approach: scan whole content
raw = ''.join(lines)
raw_clean = re.sub(r'\x1b\[.*?m', '', raw)

# Find all "let X = ..." warnings
all_state_warns = re.findall(r'`(\w+)` is updated, but is not declared with `\$state', raw_clean)
print(f"Total state warnings: {len(all_state_warns)}")
from collections import Counter
counts = Counter(all_state_warns)
print("\nAll variables needing $state:")
for v, c in counts.most_common(50):
    print(f"  {c}x  {v}")
