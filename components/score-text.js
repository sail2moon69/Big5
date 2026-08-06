const SCORE_TEXT_DE = {
  low: 'niedrig',
  neutral: 'durchschnittlich',
  high: 'hoch'
}

export function translateScoreText (scoreText, language) {
  if (language === 'de' && SCORE_TEXT_DE[scoreText]) {
    return SCORE_TEXT_DE[scoreText]
  }
  return scoreText
}
