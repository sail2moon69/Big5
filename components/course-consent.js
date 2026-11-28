// Einwilligung vor dem Test im Lehrgangsmodus mit zentraler Speicherung.
// Bei jeder inhaltlichen Änderung CONSENT_VERSION hochsetzen: die Version wird mit dem
// Zeitpunkt der Einwilligung gespeichert und belegt, welchem Text zugestimmt wurde.
// Entwurf - vor dem Einsatz durch den Datenschutzbeauftragten prüfen lassen.

export const CONSENT_VERSION = '2026-11-28'

function formatDate (value) {
  if (!value) return ''
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return `${day}.${month}.${year}`
}

export function getConsentSections ({ courseName, trainerName, deleteOn, showResult }) {
  return [
    {
      heading: 'Worum es geht',
      text: `Im Rahmen des Lehrgangs „${courseName}“ bearbeiten Sie den Big-Five-Persönlichkeitstest (120 Aussagen). Das Ergebnis dient ausschließlich der persönlichen Reflexion und der Besprechung im Lehrgang. Es wird nicht zur Leistungsbeurteilung verwendet.`
    },
    {
      heading: 'Was gespeichert wird',
      text: 'Ihr Name, Ihre Antworten und der Zeitpunkt von Einwilligung und Abschluss. Die Antworten werden verschlüsselt auf einem Server von rd-sim.de in Deutschland (Hetzner, Nürnberg) gespeichert. Ihre E-Mail-Adresse wird nur gespeichert, wenn Sie die Einladung per E-Mail erhalten haben.'
    },
    {
      heading: 'Wer Zugriff hat',
      text: `Ausschließlich die Lehrgangsleitung${trainerName ? ` (${trainerName})` : ''} und die Administration von rd-sim.de. Eine Weitergabe an Arbeitgeber, Dienststellen oder sonstige Dritte findet nicht statt.${showResult ? ' Sie sehen Ihr Ergebnis direkt nach dem Absenden selbst.' : ' Ihr Ergebnis wird Ihnen nicht direkt angezeigt, sondern im Lehrgang mit Ihnen besprochen.'}`
    },
    {
      heading: 'Wann gelöscht wird',
      text: `Automatisch am ${formatDate(deleteOn) || 'Ende der Aufbewahrungsfrist'}. In Sicherungskopien sind die Daten danach noch höchstens 14 Tage enthalten.`
    },
    {
      heading: 'Freiwilligkeit und Widerruf',
      text: 'Die Teilnahme ist freiwillig. Wenn Sie nicht einwilligen, entstehen Ihnen keine Nachteile im Lehrgang. Sie können Ihre Einwilligung jederzeit gegenüber der Lehrgangsleitung widerrufen; Ihre Daten werden dann umgehend gelöscht. Sie haben außerdem das Recht auf Auskunft, Berichtigung, Löschung und Beschwerde bei einer Datenschutz-Aufsichtsbehörde.'
    }
  ]
}

export const CONSENT_CHECKBOX_TEXT = 'Ich habe die Hinweise gelesen und willige ein, dass meine Antworten wie beschrieben gespeichert und von der Lehrgangsleitung ausgewertet werden.'
