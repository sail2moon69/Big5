#!/usr/bin/env bash
# Einmalige Einrichtung der Lehrgangsverwaltung auf dem Server. Als root ausführen:
#   bash /var/www/big5.rd-sim.de/invite-api/setup-big5-db.sh
# Legt an: PostgreSQL-Rolle und Datenbank "big5", Backup-Ordner, nächtliches Backup.
# Gibt am Ende die Werte für die GitHub-Secrets BIG5_DB_PASSWORD und BIG5_DATA_KEY aus.
# Kann gefahrlos erneut ausgeführt werden; ein vorhandenes Passwort wird dann neu gesetzt.
set -euo pipefail

DB_NAME=big5
DB_ROLE=big5
BACKUP_DIR=/var/backups/big5
CRON_FILE=/etc/cron.d/big5-backup
KEEP_DAYS=14

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte als root ausführen." >&2
  exit 1
fi

DB_PASSWORD="$(openssl rand -base64 33 | tr -d '/+=' | cut -c1-32)"

echo "== PostgreSQL: Rolle und Datenbank"
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_ROLE}'" | grep -q 1; then
  sudo -u postgres psql -q -c "ALTER ROLE ${DB_ROLE} WITH LOGIN PASSWORD '${DB_PASSWORD}'"
  echo "   Rolle ${DB_ROLE} vorhanden, Passwort neu gesetzt."
else
  sudo -u postgres psql -q -c "CREATE ROLE ${DB_ROLE} WITH LOGIN PASSWORD '${DB_PASSWORD}'"
  echo "   Rolle ${DB_ROLE} angelegt."
fi
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  echo "   Datenbank ${DB_NAME} vorhanden."
else
  sudo -u postgres createdb -O "${DB_ROLE}" "${DB_NAME}"
  echo "   Datenbank ${DB_NAME} angelegt."
fi
# nur die eigene Rolle darf sich mit der Datenbank verbinden
sudo -u postgres psql -q -d "${DB_NAME}" -c "REVOKE ALL ON DATABASE ${DB_NAME} FROM PUBLIC"
sudo -u postgres psql -q -d "${DB_NAME}" -c "GRANT CONNECT, TEMPORARY ON DATABASE ${DB_NAME} TO ${DB_ROLE}"

echo "== Verbindungstest über 127.0.0.1"
if PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_ROLE}" -d "${DB_NAME}" -tAc 'SELECT 1' | grep -q 1; then
  echo "   OK"
else
  echo "   FEHLER: Anmeldung von ${DB_ROLE} über 127.0.0.1 nicht möglich. pg_hba.conf prüfen" >&2
  echo "   (benötigt: host ${DB_NAME} ${DB_ROLE} 127.0.0.1/32 scram-sha-256)." >&2
  exit 1
fi

echo "== Backup"
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
cat > "${CRON_FILE}" <<CRON
# Big Five Lehrgangsverwaltung: nächtliches Backup, ${KEEP_DAYS} Tage aufbewahrt.
# Die Ergebnisse darin sind verschlüsselt; ohne BIG5_DATA_KEY sind sie nicht lesbar.
SHELL=/bin/bash
15 3 * * * root sudo -u postgres pg_dump -Fc ${DB_NAME} > ${BACKUP_DIR}/${DB_NAME}-\$(date +\%F).dump.tmp && mv ${BACKUP_DIR}/${DB_NAME}-\$(date +\%F).dump.tmp ${BACKUP_DIR}/${DB_NAME}-\$(date +\%F).dump && chmod 600 ${BACKUP_DIR}/${DB_NAME}-\$(date +\%F).dump; find ${BACKUP_DIR} -name '${DB_NAME}-*.dump' -mtime +${KEEP_DAYS} -delete
CRON
chmod 644 "${CRON_FILE}"
echo "   ${CRON_FILE} angelegt (täglich 03:15, ${KEEP_DAYS} Tage)."

DATA_KEY="$(openssl rand -base64 32)"
cat <<DONE

==========================================================================
Fertig. Bitte jetzt in GitHub anlegen (Settings → Secrets and variables →
Actions → New repository secret):

  BIG5_DB_PASSWORD = ${DB_PASSWORD}
  BIG5_DATA_KEY    = ${DATA_KEY}

WICHTIG: BIG5_DATA_KEY zusätzlich im Passwortmanager ablegen. GitHub zeigt
Secrets nach dem Speichern nie wieder an. Ohne diesen Schlüssel sind die
gespeicherten Ergebnisse (auch in Backups) nicht mehr lesbar. Wenn der
Schlüssel schon einmal gesetzt war, den ALTEN behalten und diesen ignorieren.

Danach: nginx-Block aus deploy/nginx-big5-api.conf.example (im Repo) ergänzen,
Deploy erneut auslösen und das erste Admin-Konto anlegen:
  cd /var/www/big5.rd-sim.de/invite-api
  node manage.js add-admin <ihre-adresse> "<Ihr Name>"
==========================================================================
DONE
