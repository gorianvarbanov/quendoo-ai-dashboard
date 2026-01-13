import re

# Read the file
with open('src/routes/tasks.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace await (await getDb()) with db
content = re.sub(r'await \(await getDb\(\)\)', 'db', content)

# Replace collection('cron_job_history') with collection('task_history')
content = content.replace("collection('cron_job_history')", "collection('task_history')")

# Find all route handlers and add const db = await getDb() if not present
def add_db_init(match):
    handler = match.group(0)
    # Check if already has const db = await getDb()
    if 'const db = await getDb()' in handler:
        return handler

    # Find the try block
    try_match = re.search(r'(router\.(get|post|put|delete)\([^)]+\),?\s*async\s*\([^)]+\)\s*=>\s*{\s*try\s*{)', handler, re.DOTALL)
    if try_match:
        # Insert after try {
        insert_pos = try_match.end()
        return handler[:insert_pos] + '\n    const db = await getDb();' + handler[insert_pos:]
    return handler

# Process each route handler
pattern = r'router\.(get|post|put|delete)\([^}]+?\n}\)'
content = re.sub(pattern, add_db_init, content, flags=re.DOTALL)

# Write back
with open('src/routes/tasks.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed tasks.js")
