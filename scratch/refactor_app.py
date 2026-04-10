
import sys

file_path = '/Users/masmastech/Library/CloudStorage/GoogleDrive-simsaraqari@gmail.com/My Drive/crm google studio/شركة-مصادقة-العقارية/src/App.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line numbers are 1-indexed
start_line = 301
end_line = 1898

# Remove lines from start_line to end_line (inclusive)
# Note: list is 0-indexed, so start_line-1 to end_line
new_lines = lines[:start_line-1] + ['\n// --- App Component ---\n\n'] + lines[end_line:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Removed lines {start_line} to {end_line}")
