#!/bin/bash
echo "=== Updating admin email and password ==="

# Update email
sudo docker exec adroit-db-1 psql -U adroit -d adroit -c \
  "UPDATE users SET email='admin@gmail.com' WHERE role='sysadmin';"

# Update password hash using pgcrypto (bcrypt)
sudo docker exec adroit-db-1 psql -U adroit -d adroit -c \
  "UPDATE users SET password_hash=crypt('Admin123', gen_salt('bf')), must_change_password=false WHERE role='sysadmin';"

echo "=== Result ==="
sudo docker exec adroit-db-1 psql -U adroit -d adroit -c \
  "SELECT id, email, role, must_change_password FROM users;"
