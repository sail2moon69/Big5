// Domain codes follow @alheimsins/b5-result-text: O, C, E, A, N (OCEAN)
const NOTES = {
  de: {
    O: {
      low: 'In der Einsatzleitung bedeutet das: Sie verlassen sich gern auf bewährte Abläufe und Standardvorgehen – das gibt Ihnen und dem Team Sicherheit in bekannten Lagen. Achten Sie bei ungewöhnlichen oder atypischen Schadenslagen bewusst darauf, auch unkonventionelle Lösungswege in Betracht zu ziehen, wenn die Standardtaktik nicht greift.',
      neutral: 'In der Einsatzleitung bedeutet das: Sie können sowohl auf bewährte Abläufe zurückgreifen als auch bei Bedarf von Standardvorgehen abweichen. Diese Flexibilität ist gerade bei wechselnden Lagebildern von Vorteil.',
      high: 'In der Einsatzleitung bedeutet das: Sie sind offen für neue Taktiken und ungewöhnliche Lösungsansätze – ein Vorteil bei komplexen oder atypischen Lagen. Prüfen Sie unter Zeitdruck bewusst, ob eine bewährte Standardmaßnahme nicht doch schneller zum Ziel führt, bevor Sie einen neuen Weg einschlagen.'
    },
    C: {
      low: 'In der Einsatzleitung bedeutet das: Spontane, situative Entscheidungen fallen Ihnen leicht. Nutzen Sie bewusst Checklisten und strukturierte Übergaben (z. B. SAMPLER, ABCDE), damit bei Dokumentation und Übergabe an nachfolgende Kräfte nichts verloren geht.',
      neutral: 'In der Einsatzleitung bedeutet das: Sie verbinden strukturiertes Vorgehen mit der nötigen Flexibilität für spontane Entscheidungen – eine gute Balance für die meisten Einsatzlagen.',
      high: 'In der Einsatzleitung bedeutet das: Sie arbeiten strukturiert und zuverlässig, was sich bei systematischer Lagebeurteilung und sauberer Dokumentation auszahlt. Bleiben Sie in extrem dynamischen Lagen offen dafür, Checklisten situativ anzupassen statt starr daran festzuhalten.'
    },
    E: {
      low: 'In der Einsatzleitung bedeutet das: Sie treten eher zurückhaltend auf und überlegen, bevor Sie kommunizieren – das führt oft zu klaren, durchdachten Anweisungen. Achten Sie in lauten, hektischen Einsatzlagen bewusst darauf, präsent und hörbar zu bleiben, damit Ihre Anweisungen ankommen.',
      neutral: 'In der Einsatzleitung bedeutet das: Sie können situativ sowohl zurückhaltend zuhören als auch energisch Anweisungen geben – das erleichtert die Führung unterschiedlicher Teams und Lagen.',
      high: 'In der Einsatzleitung bedeutet das: Sie treten energisch und durchsetzungsstark auf und können ein Team schnell mobilisieren. Achten Sie bewusst darauf, auch leiseren Stimmen im Team Raum zu geben, bevor Sie Entscheidungen treffen.'
    },
    A: {
      low: 'In der Einsatzleitung bedeutet das: Sie treffen sachorientierte, auch unbequeme Entscheidungen konsequent – eine wichtige Stärke bei Triage-Situationen. Achten Sie bewusst darauf, Entscheidungen gegenüber Team und Betroffenen empathisch zu vermitteln, damit sie nicht als kühl oder distanziert wirken.',
      neutral: 'In der Einsatzleitung bedeutet das: Sie können empathisch auf Ihr Team eingehen und dennoch sachlich-konsequente Entscheidungen treffen, wenn es die Lage erfordert.',
      high: 'In der Einsatzleitung bedeutet das: Sie führen mit Empathie und Vertrauen, was Teamzusammenhalt in belastenden Lagen stärkt. Achten Sie bewusst darauf, auch schwierige, notwendige Entscheidungen – etwa bei der Triage – konsequent zu treffen, statt sie aus Rücksicht hinauszuzögern.'
    },
    N: {
      low: 'In der Einsatzleitung bedeutet das: Sie bleiben auch unter hohem Druck ruhig und besonnen – eine zentrale Stärke für die Einsatzleitung in Stresssituationen. Achten Sie bewusst darauf, Stresssignale bei Teammitgliedern nicht zu unterschätzen, nur weil Sie selbst gelassen bleiben.',
      neutral: 'In der Einsatzleitung bedeutet das: Sie reagieren in den meisten Lagen angemessen auf Druck und Stress, mit gelegentlichen Schwankungen in besonders fordernden Situationen.',
      high: 'In der Einsatzleitung bedeutet das: Sie reagieren intensiver auf Stress und Druck als der Durchschnitt. Das Wissen um diese eigene Reaktionsweise ist wertvoll – planen Sie bewusst Bewältigungsstrategien (Delegation, kurze Pausen, Nachbesprechung) ein und zögern Sie nicht, sich in Extremlagen Unterstützung zu holen.'
    }
  }
}

export function getLeadershipNote (domainCode, scoreText, language) {
  const languageNotes = NOTES[language]
  if (!languageNotes) {
    return null
  }
  const domainNotes = languageNotes[domainCode]
  if (!domainNotes) {
    return null
  }
  return domainNotes[scoreText] || null
}
