#!/usr/bin/env python3
"""
Replaces Caddy proxy with nginx + self-signed cert in docker-compose.yml
and writes the nginx.conf file.
"""
import subprocess, os

DEPLOY_DIR = '/home/ec2-user/adroit/deploy'

# 1. Generate self-signed cert
cert_dir = os.path.join(DEPLOY_DIR, 'certs')
os.makedirs(cert_dir, exist_ok=True)
subprocess.run([
    'openssl', 'req', '-x509', '-nodes', '-days', '3650',
    '-newkey', 'rsa:2048',
    '-keyout', f'{cert_dir}/selfsigned.key',
    '-out',    f'{cert_dir}/selfsigned.crt',
    '-subj',   '/CN=51.20.117.219',
    '-addext', 'subjectAltName=IP:51.20.117.219'
], check=True)
print('Self-signed cert generated.')

# 2. Write nginx.conf
nginx_conf = """events { worker_connections 1024; }

http {
    server {
        listen 80;
        server_name _;
        # Clear HSTS so browser stops forcing https
        add_header Strict-Transport-Security "max-age=0; includeSubDomains" always;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name _;

        ssl_certificate     /etc/nginx/certs/selfsigned.crt;
        ssl_certificate_key /etc/nginx/certs/selfsigned.key;
        ssl_protocols       TLSv1.2 TLSv1.3;
        ssl_ciphers         HIGH:!aNULL:!MD5;

        # Clear HSTS after one visit so browser won't force https forever
        add_header Strict-Transport-Security "max-age=0" always;

        client_max_body_size 60M;

        location / {
            proxy_pass         http://app:3000;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade $http_upgrade;
            proxy_set_header   Connection keep-alive;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto https;
        }
    }
}
"""
with open(os.path.join(DEPLOY_DIR, 'nginx.conf'), 'w') as f:
    f.write(nginx_conf)
print('nginx.conf written.')

# 3. Patch docker-compose.yml — replace proxy service
with open(os.path.join(DEPLOY_DIR, 'docker-compose.yml'), 'r') as f:
    compose = f.read()

old_proxy = """  proxy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on: [app]
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: ${DOMAIN}
      ACME_EMAIL: ${ACME_EMAIL:-}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks: [internal]"""

new_proxy = """  proxy:
    image: nginx:alpine
    restart: unless-stopped
    depends_on: [app]
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    networks: [internal]"""

if old_proxy in compose:
    compose = compose.replace(old_proxy, new_proxy)
    print('Replaced Caddy with nginx in docker-compose.yml')
else:
    # Try a looser replacement
    import re
    compose = re.sub(
        r'  proxy:\n    image: caddy.*?networks: \[internal\]',
        new_proxy,
        compose,
        flags=re.DOTALL
    )
    print('Regex-replaced Caddy with nginx in docker-compose.yml')

# Remove old caddy volumes
compose = compose.replace('  caddy-data:\n', '')
compose = compose.replace('  caddy-config:\n', '')

with open(os.path.join(DEPLOY_DIR, 'docker-compose.yml'), 'w') as f:
    f.write(compose)
print('docker-compose.yml patched.')
print('DONE - run: cd adroit/deploy && sudo docker compose up -d --force-recreate proxy')
