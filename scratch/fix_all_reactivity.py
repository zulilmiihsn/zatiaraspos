import os
import re

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    original_content = content
    
    # Simple variables: $: x = y; -> let x = $derived(y);
    # But wait, if x is already declared with let x;, we shouldn't add let.
    # It's safer to check if 'let x' exists in the file.
    
    lines = content.split('\n')
    new_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Match $: x = ...
        m1 = re.match(r'^(\s*)\$:\s*([a-zA-Z0-9_]+)\s*=\s*(.+)$', line)
        
        # Match $: if (...) ...
        m2 = re.match(r'^(\s*)\$:\s*if\s*\(', line)
        
        # Match $: {
        m3 = re.match(r'^(\s*)\$:\s*\{', line)
        
        if m1:
            indent, var_name, rest = m1.groups()
            
            # check if var_name is already declared in previous lines
            is_declared = False
            for prev in new_lines:
                if re.search(r'\blet\s+' + var_name + r'\b', prev):
                    is_declared = True
                    break
                    
            if rest.endswith(';'):
                rest = rest[:-1]
                
            if is_declared:
                # Can't use $derived if it's already a let variable that is mutated?
                # Actually, if it's already a let, it might be a derived state but they used `let` for type or initial value.
                # Let's just do `$effect(() => { var_name = rest; });` for existing lets to be safe
                new_lines.append(f"{indent}$effect(() => {{ {var_name} = {rest}; }});")
            else:
                new_lines.append(f"{indent}let {var_name} = $derived({rest});")
        elif m2:
            # $: if (...)
            # Just wrap in $effect
            indent = m2.group(1)
            line = line.replace('$:', '$effect(() => {', 1)
            # Find the end of the statement or block
            # This is tricky, let's just do a naive approach for single line if
            if line.endswith(';'):
                line += ' });'
                new_lines.append(line)
            else:
                # block?
                if line.endswith('{'):
                    new_lines.append(line)
                    # Need to find matching brace and append '});'
                    brace_count = 1
                    i += 1
                    while i < len(lines):
                        sub_line = lines[i]
                        brace_count += sub_line.count('{') - sub_line.count('}')
                        if brace_count == 0:
                            sub_line += ');'
                            new_lines.append(sub_line)
                            break
                        else:
                            new_lines.append(sub_line)
                        i += 1
                else:
                    new_lines.append(line)
        elif m3:
            indent = m3.group(1)
            new_lines.append(f"{indent}$effect(() => {{")
            # Need to find matching brace and append ');'
            brace_count = 1
            i += 1
            while i < len(lines):
                sub_line = lines[i]
                brace_count += sub_line.count('{') - sub_line.count('}')
                if brace_count == 0:
                    sub_line = sub_line.replace('}', '});', 1)
                    new_lines.append(sub_line)
                    break
                else:
                    new_lines.append(sub_line)
                i += 1
        elif re.match(r'^(\s*)\$:\s*([a-zA-Z0-9_]+)\s*(.*)$', line) and not '=' in line:
            # multiline variable assignment like $: x = \n ...
            # We'll just skip this script for multiline if we can't easily parse it, but let's try
            new_lines.append(line)
        else:
            new_lines.append(line)
            
        i += 1
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write('\n'.join(new_lines))

files_to_fix = [
    "src/routes/laporan/+page.svelte",
    "src/lib/components/shared/toastNotification.svelte",
    "src/lib/components/shared/pwaInstallDialog.svelte",
    "src/lib/components/shared/dropdownSheet.svelte",
    "src/lib/components/shared/bottomNav.svelte",
    "src/lib/components/shared/aiChatModal.svelte"
]

for f in files_to_fix:
    if os.path.exists(f):
        print(f"Processing {f}...")
        process_file(f)
