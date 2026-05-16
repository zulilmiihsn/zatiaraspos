import sys
with open('src/lib/services/dataService.ts', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'supabase' in line:
            sys.stdout.buffer.write(f"{i+1}: {line.strip()}\n".encode('utf-8'))
