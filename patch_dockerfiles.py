import os
import re

package_copies = """# Copy root package files
COPY package.json package-lock.json ./
# Copy all workspace package.json files to preserve workspace structure for npm ci
COPY apps/vtt/package.json ./apps/vtt/
COPY apps/vtt/apps/generator-hub/package.json ./apps/vtt/apps/generator-hub/
COPY apps/vtt/services/asset-service/package.json ./apps/vtt/services/asset-service/
COPY apps/forge/package.json ./apps/forge/
COPY apps/codex/services/admin-ui/package.json ./apps/codex/services/admin-ui/
COPY apps/codex/services/dm-ui/package.json ./apps/codex/services/dm-ui/
COPY apps/codex/services/doc-api/package.json ./apps/codex/services/doc-api/
COPY apps/codex/services/doc-processor/package.json ./apps/codex/services/doc-processor/
COPY apps/codex/services/doc-websocket/package.json ./apps/codex/services/doc-websocket/
COPY apps/codex/docs/package.json ./apps/codex/docs/
"""

dockerfiles = {
    "apps/codex/services/doc-api/Dockerfile": "apps/codex/services/doc-api",
    "apps/codex/services/doc-processor/Dockerfile": "apps/codex/services/doc-processor",
    "apps/codex/services/doc-websocket/Dockerfile": "apps/codex/services/doc-websocket",
    "apps/codex/services/admin-ui/Dockerfile": "apps/codex/services/admin-ui",
    "apps/codex/services/dm-ui/Dockerfile": "apps/codex/services/dm-ui",
    "apps/forge/Dockerfile": "apps/forge",
    "apps/vtt/docker/frontend.Dockerfile": "apps/vtt",
    "apps/vtt/docker/backend.Dockerfile": "apps/vtt",
    "apps/vtt/docker/asset-service.Dockerfile": "apps/vtt/services/asset-service"
}

for df_path, workspace_path in dockerfiles.items():
    if not os.path.exists(df_path):
        print(f"Skipping {df_path}")
        continue
    
    with open(df_path, "r") as f:
        content = f.read()

    # 1. Replace COPY package.json... with the block
    content = re.sub(r'COPY\s+package\.json.*?(?:\n|$)', package_copies, content)
    
    # 2. Replace RUN npm ci with the workspace version
    content = re.sub(r'RUN\s+npm\s+ci', f'RUN npm ci --workspace={workspace_path} --include-workspace-root', content)

    # 3. Handle COPY of source code and WORKDIR in builder
    # Since the build context is now root, COPY src ./src needs to become COPY apps/xyz/src ./apps/xyz/src
    content = re.sub(r'COPY\s+src\s+\./src', f'COPY {workspace_path}/src ./{workspace_path}/src', content)
    content = re.sub(r'COPY\s+prisma\s+\./prisma', f'COPY {workspace_path}/prisma ./{workspace_path}/prisma', content)
    content = re.sub(r'COPY\s+tsconfig\.json\s+\.', f'COPY {workspace_path}/tsconfig.json ./{workspace_path}/', content)
    
    # Update --from=builder /app/src ./src to /app/apps/xyz/src ./apps/xyz/src
    content = re.sub(r'COPY\s+--from=builder\s+/app/src\s+\./src', f'COPY --from=builder /app/{workspace_path}/src ./{workspace_path}/src', content)
    content = re.sub(r'COPY\s+--from=builder\s+/app/prisma\s+\./prisma', f'COPY --from=builder /app/{workspace_path}/prisma ./{workspace_path}/prisma', content)
    content = re.sub(r'COPY\s+--from=builder\s+/app/tsconfig\.json\s+\./tsconfig\.json', f'COPY --from=builder /app/{workspace_path}/tsconfig.json ./{workspace_path}/tsconfig.json', content)
    
    # For Forge which has public
    content = re.sub(r'COPY\s+public\s+\./public', f'COPY {workspace_path}/public ./{workspace_path}/public', content)
    content = re.sub(r'COPY\s+--from=builder\s+/app/public\s+\./public', f'COPY --from=builder /app/{workspace_path}/public ./{workspace_path}/public', content)
    content = re.sub(r'COPY\s+--from=builder\s+/app/dist\s+\./dist', f'COPY --from=builder /app/{workspace_path}/dist ./{workspace_path}/dist', content)
    
    # Update start command if it's running from src/
    content = re.sub(r'npx\s+tsx\s+src/server\.ts', f'npx tsx {workspace_path}/src/server.ts', content)
    
    # Wait, the CMD might be better if we just change WORKDIR before CMD?
    # Or we can just set WORKDIR /app/apps/... at the end
    if 'CMD' in content and 'WORKDIR /app/' not in content:
        content = content.replace('USER fastify', f'USER fastify\nWORKDIR /app/{workspace_path}')
        content = content.replace('USER node', f'USER node\nWORKDIR /app/{workspace_path}')

    with open(df_path, "w") as f:
        f.write(content)
        print(f"Updated {df_path}")
