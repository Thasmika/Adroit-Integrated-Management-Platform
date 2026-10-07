const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5432/adroit' });

client.connect()
  .then(() => bcrypt.hash('Adroit@2026', 11))
  .then(hash => client.query('UPDATE users SET password_hash = $1, must_change_password = false, failed_logins = 0, locked_until = NULL, active = true WHERE email = $2', [hash, 'kasun.bandara@adroit.ae']))
  .then(() => {
    console.log('Password reset successfully.');
    client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
  });
