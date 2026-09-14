import glob
import re
import os

workflows = glob.glob(".github/workflows/*.yml")

for wf in workflows:
    with open(wf, "r") as f:
        content = f.read()
    
    # Replace `context: ./apps/...` with `context: .`
    # Be careful not to replace `context: ${{ matrix.context }}` if it's there
    content = re.sub(r'context:\s+\./apps/[^\s]+', 'context: .', content)
    
    with open(wf, "w") as f:
        f.write(content)
        print(f"Updated {wf}")
