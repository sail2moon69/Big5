import { getLeadershipNote, getReflectionQuestions } from './result-leadership-notes'
import { translateScoreText } from './score-text'
const calculateScore = require('@alheimsins/bigfive-calculate-score')
const getResult = require('@alheimsins/b5-result-text')
const { getInfo } = require('@alheimsins/b5-result-text')

export function decorateResume (resume, language) {
  return resume.map(domain => {
    // look up leadership notes/reflection questions by the library's raw (always-English) scoreText,
    // before it gets translated for display below
    const leadershipNote = getLeadershipNote(domain.domain, domain.scoreText, language)
    const reflectionQuestions = getReflectionQuestions(domain.domain, language)
    const facets = domain.facets
      ? domain.facets.map(facet => Object.assign({}, facet, { scoreText: translateScoreText(facet.scoreText, language) }))
      : domain.facets
    return Object.assign({}, domain, {
      scoreText: translateScoreText(domain.scoreText, language),
      leadershipNote,
      reflectionQuestions,
      facets
    })
  })
}

// answers as stored by the test page -> the resume the result page and the PDF report use
export function buildResume (answers, requestedLanguage, fallbackLanguage = 'de') {
  const scores = calculateScore({ answers })
  const known = getInfo().languages.map(lang => lang.id)
  const language = known.includes(requestedLanguage) ? requestedLanguage : fallbackLanguage
  return { scores, language, resume: decorateResume(getResult({ scores, lang: language }), language) }
}
