/**
 * Robust JSON extractor from LLM text output
 * Ported from legacy/server/routes/ai.js
 */
export function extractJSON(text) {
  if (!text) {
    throw new Error('Empty AI output received');
  }

  // Strip markdown code fences
  let clean = text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try to find a JSON array first, then object
  const arrStart = clean.indexOf('[');
  const objStart = clean.indexOf('{');

  let start = -1;
  let end = -1;
  let isArray = false;

  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    start = arrStart;
    end = clean.lastIndexOf(']');
    isArray = true;
  } else if (objStart !== -1) {
    start = objStart;
    end = clean.lastIndexOf('}');
  }

  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON structure found in AI response');
  }

  let jsonStr = clean.slice(start, end + 1);

  // Fix unescaped newlines inside string values
  jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (match, inner) => {
    const fixed = inner
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `"${fixed}"`;
  });

  // Strip single-line comments // that LLMs sometimes insert
  jsonStr = jsonStr.replace(/(^|[^:\\])\/\/.*$/gm, '$1');

  const parsed = JSON.parse(jsonStr);

  // Unwrap if wrapped in an object container (do not unwrap if it is a full coding challenge object)
  if (!isArray && parsed.questions) return parsed.questions;
  if (!isArray && parsed.variants) return parsed.variants;
  if (!isArray && !parsed.title && !parsed.initial_code && parsed.test_cases) return parsed.test_cases;
  return parsed;
}
