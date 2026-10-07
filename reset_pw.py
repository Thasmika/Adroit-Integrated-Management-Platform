#!/usr/bin/env python3
import subprocess

# List all users
result = subprocess.run(
    ['docker', 'compose', 'exec', 'db', 'psql', '-U', 'adroit', '-d', 'adroit', '-c', 'SELECT email, name, role FROM users;'],
    cwd='/home/ec2-user/adroit/deploy',
    capture_output=True, text=True
)
print("USERS:", result.stdout, result.stderr)

# Reset password using bcrypt via node
reset = subprocess.run(
    ['docker', 'compose', 'exec', 'app', 'node', '-e', '''
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('Adroit@2024', 12);
console.log(hash);
'''],
    cwd='/home/ec2-user/adroit/deploy',
    capture_output=True, text=True
)
print("HASH result:", reset.stdout.strip(), reset.stderr.strip())
hash_val = reset.stdout.strip()

if hash_val:
    update = subprocess.run(
        ['docker', 'compose', 'exec', 'db', 'psql', '-U', 'adroit', '-d', 'adroit', '-c',
         f"UPDATE users SET password_hash = '{hash_val}', must_change_password = false WHERE role = 'sysadmin' OR email LIKE '%admin%'; SELECT email, role FROM users WHERE role='sysadmin' OR email LIKE '%admin%';"],
        cwd='/home/ec2-user/adroit/deploy',
        capture_output=True, text=True
    )
    print("UPDATE:", update.stdout, update.stderr)
else:
    print("ERROR: Could not generate hash")
