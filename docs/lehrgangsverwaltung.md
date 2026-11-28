# Lehrgangsverwaltung

Zentrale Übersicht für Lehrgangsleitungen unter `https://big5.rd-sim.de/dashboard`:
Lehrgänge anlegen, Teilnehmende einladen (Handout-PDF mit QR-Code oder E-Mail),
Bearbeitungsstand sehen, Ergebnisberichte einzeln oder als ZIP herunterladen.

Die bisherigen Modi (Einladung per Link, versiegelter Mailversand) bleiben unverändert
nutzbar. Die Lehrgangsverwaltung ist ausgeschaltet, solange die Datenbank nicht
eingerichtet ist.

## Funktionsweise

| Schritt | Was passiert |
|---|---|
| Lehrgang anlegen | Name, Zeitraum, PDF-Layout, Löschfrist (Standard 30 Tage nach Ende), ob Teilnehmende ihr Ergebnis selbst sehen |
| Teilnehmende eintragen | `Name;E-Mail` pro Zeile. Jede Person erhält einen zufälligen Token, der Link enthält nur diesen Token |
| Einladen | Handout-PDF (eine Seite pro Person, QR-Code) oder E-Mail. Status wechselt auf „eingeladen“ |
| Test | Teilnehmende lesen die Einwilligung und bestätigen sie (Status „begonnen“). Antworten bleiben bis zum Absenden im Browser |
| Absenden | Antworten werden verschlüsselt gespeichert (Status „abgeschlossen“). Jeder Link funktioniert nur einmal |
| Auswertung | Lehrgangsleitung lädt Berichte herunter. Das PDF entsteht im Browser aus den gespeicherten Antworten |
| Löschung | Automatisch nach Ablauf der Frist, sofort über „Lehrgang jetzt löschen“, einzelne Person über „Entfernen“ (z. B. bei Widerruf) |

Rollen: **Admin** sieht alle Lehrgänge und verwaltet Konten. **Lehrgangsleitung** sieht nur eigene Lehrgänge.

## Technik und Sicherheit

- PostgreSQL-Datenbank `big5` mit eigener Rolle `big5` auf demselben Server, nur über `127.0.0.1` erreichbar.
- Antworten und Einladungs-Token sind mit AES-256-GCM verschlüsselt (`BIG5_DATA_KEY`). Wer nur Datenbank oder Backup hat, kann sie nicht lesen.
- Passwörter: scrypt-Hash. Sitzung: HttpOnly-Cookie, 12 Stunden, `SameSite=Strict`; Schutz gegen Cross-Site-Anfragen über eigenen Header.
- Login-Bremse: 10 Fehlversuche pro 15 Minuten und Adresse, zusätzlich Ratenlimit in nginx.
- Protokoll (`audit_log`): Anmeldung, Anlegen, Löschen, jeder Ergebnis-Download – nur mit IDs, ohne Namen. Wird nach 365 Tagen gelöscht.
- Backup: täglich 03:15 (`pg_dump`), 14 Tage aufbewahrt in `/var/backups/big5`.

**Bekannte Einschränkung:** Der Dienst läuft unter dem Linux-Benutzer `memorymcp`, den auch memory-mcp nutzt. Ein Prozess dieses Benutzers könnte `.env` lesen und damit Datenbank und Schlüssel erreichen. Empfehlung: eigener Benutzer `big5` für den Dienst (Anpassung von Deploy und `DEPLOY_USER`).

## Einrichtung (einmalig)

Reihenfolge: zuerst mergen (der Deploy läuft durch, die Lehrgangsverwaltung bleibt noch aus), dann:

1. **Datenbank und Backup** – als root auf dem Server:
   ```bash
   bash /var/www/big5.rd-sim.de/invite-api/setup-big5-db.sh
   ```
   Das Skript gibt am Ende zwei Werte aus.
2. **GitHub-Secrets** anlegen: `BIG5_DB_PASSWORD` und `BIG5_DATA_KEY`. `BIG5_DATA_KEY` zusätzlich im Passwortmanager sichern – ohne ihn sind alle gespeicherten Ergebnisse verloren.
3. **nginx** – den Block `location /api/app/` und die Zeile `limit_req_zone … zone=big5app` aus `deploy/nginx-big5-api.conf.example` ergänzen, dann `nginx -t && systemctl reload nginx`.
4. **Deploy erneut auslösen** (GitHub → Actions → „Deploy to Hetzner“ → „Run workflow“). Prüfen: `curl -s https://big5.rd-sim.de/api/app/auth/me` liefert `{"error":"Bitte melden Sie sich an."}`.
5. **Erstes Admin-Konto**:
   ```bash
   cd /var/www/big5.rd-sim.de/invite-api
   node manage.js add-admin ihre@adresse.de "Vorname Nachname"
   ```
   Das ausgegebene Passwort nach der ersten Anmeldung unter „Passwort ändern“ ersetzen.

Weitere Befehle: `node manage.js list-trainers`, `reset-password <email>`, `cleanup`.

## Datenschutz – Entwurf zur Prüfung durch den Datenschutzbeauftragten

Die Einwilligung, die Teilnehmende vor dem Test bestätigen, steht in
`components/course-consent.js` (mit Versionsnummer; Zeitpunkt und Version werden gespeichert).
Die folgenden Punkte gehören zusätzlich in Datenschutzerklärung und Verzeichnis der
Verarbeitungstätigkeiten (Art. 30 DSGVO).

| Punkt | Inhalt |
|---|---|
| Verantwortlicher | rd-sim.de (bitte Anschrift und Kontakt ergänzen) |
| Zweck | Persönlichkeitsreflexion im Rahmen von Führungslehrgängen; Besprechung im Lehrgang. Keine Leistungsbeurteilung |
| Rechtsgrundlage | Einwilligung, Art. 6 Abs. 1 lit. a DSGVO. Bei Lehrgängen im Beschäftigungskontext zusätzlich Freiwilligkeit nach § 26 Abs. 2 BDSG sicherstellen: keine Nachteile bei Nichtteilnahme, keine Weitergabe an Arbeitgeber |
| Betroffene | Teilnehmende der Lehrgänge; Lehrgangsleitungen (Konten) |
| Daten | Name, ggf. E-Mail, 120 Antworten, Zeitpunkte von Einladung, Einwilligung und Abschluss, Version des Einwilligungstextes |
| Empfänger | Lehrgangsleitung des jeweiligen Lehrgangs, Administration. Auftragsverarbeiter: Hetzner Online GmbH (Hosting, AVV liegt vor); Mailversand über den konfigurierten SMTP-Dienst (AVV prüfen) |
| Drittland | keine Übermittlung |
| Löschfrist | automatisch X Tage nach Lehrgangsende (Standard 30), Backups weitere 14 Tage; Konto-Protokoll 365 Tage |
| TOM | Verschlüsselung der Ergebnisse (AES-256-GCM), TLS, rollenbasierter Zugriff, Passwort-Hashing, Protokollierung der Abrufe, Datenbank nur lokal erreichbar, tägliche Backups |
| Widerruf | gegenüber der Lehrgangsleitung; Umsetzung über „Entfernen“ im Dashboard (löscht das Ergebnis sofort) |

Offene Punkte für die Prüfung:
- Ist die Teilnahme im konkreten Lehrgang tatsächlich freiwillig, oder ist der Test verpflichtender Bestandteil? Im zweiten Fall trägt die Einwilligung nicht, dann ist eine andere Rechtsgrundlage nötig.
- Persönlichkeitsprofile sind keine besonderen Kategorien nach Art. 9 DSGVO, aber sensibel. Eine Datenschutz-Folgenabschätzung ist voraussichtlich nicht erforderlich; das sollte der DSB bestätigen.
- Text der Einwilligung (`components/course-consent.js`) und die Angabe „Hetzner, Nürnberg“ an den tatsächlichen Serverstandort anpassen.
