#!/usr/bin/env node
// Administration on the server, e.g. creating the first admin account:
//   cd /var/www/big5.rd-sim.de/invite-api
//   node manage.js add-admin admin@example.org "Vorname Nachname"
// Reads the same .env as the service.
const fs = require('fs')
const path = require('path')

function loadEnvFile (file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}

loadEnvFile(path.join(__dirname, '.env'))

const db = require('./db')
const security = require('./security')
const { runCleanup } = require('./courses')

const USAGE = `Verwendung:
  node manage.js migrate
  node manage.js add-admin <email> "<Name>"
  node manage.js add-trainer <email> "<Name>"
  node manage.js reset-password <email>
  node manage.js list-trainers
  node manage.js cleanup`

async function addTrainer (email, name, role) {
  if (!email || !name) throw new Error(USAGE)
  await db.migrate()
  const password = security.generatePassword()
  await db.query(
    'INSERT INTO trainers (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
    [email.trim().toLowerCase(), name.trim(), await security.hashPassword(password), role]
  )
  console.log(`Konto angelegt (${role}): ${email}`)
  console.log(`Erstes Passwort: ${password}`)
  console.log('Bitte nach der ersten Anmeldung im Dashboard ändern.')
}

async function main () {
  const [command, ...args] = process.argv.slice(2)
  switch (command) {
    case 'migrate':
      await db.migrate()
      console.log('Datenbank ist aktuell.')
      break
    case 'add-admin':
      await addTrainer(args[0], args[1], 'admin')
      break
    case 'add-trainer':
      await addTrainer(args[0], args[1], 'trainer')
      break
    case 'reset-password': {
      if (!args[0]) throw new Error(USAGE)
      const password = security.generatePassword()
      const { rowCount } = await db.query(
        'UPDATE trainers SET password_hash = $2, disabled = false WHERE email = $1',
        [args[0].trim().toLowerCase(), await security.hashPassword(password)]
      )
      if (!rowCount) throw new Error(`Kein Konto für ${args[0]}`)
      await db.query('DELETE FROM sessions WHERE trainer_id = (SELECT id FROM trainers WHERE email = $1)', [args[0].trim().toLowerCase()])
      console.log(`Neues Passwort für ${args[0]}: ${password}`)
      break
    }
    case 'list-trainers': {
      const { rows } = await db.query('SELECT email, name, role, disabled FROM trainers ORDER BY email')
      rows.forEach(row => console.log(`${row.email}\t${row.name}\t${row.role}${row.disabled ? '\tgesperrt' : ''}`))
      break
    }
    case 'cleanup':
      console.log(`${await runCleanup()} abgelaufene(r) Lehrgang/Lehrgänge gelöscht.`)
      break
    default:
      throw new Error(USAGE)
  }
}

main()
  .catch(error => {
    console.error(error.code === '23505' ? 'Für diese E-Mail-Adresse gibt es bereits ein Konto.' : error.message)
    process.exitCode = 1
  })
  .finally(() => db.close())
