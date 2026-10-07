#!/usr/bin/env python3
path = '/home/ec2-user/adroit/deploy/docker-compose.yml'
with open(path, 'r') as f:
    content = f.read()

content = content.replace('COOKIE_SECURE: "true"', 'COOKIE_SECURE: "false"')
content = content.replace('PUBLIC_URL: https://${DOMAIN:?set DOMAIN in .env}', 'PUBLIC_URL: http://51.20.117.219')

with open(path, 'w') as f:
    f.write(content)

print('Patched successfully:')
for line in content.splitlines():
    if 'COOKIE_SECURE' in line or 'PUBLIC_URL' in line:
        print(' ', line.strip())
