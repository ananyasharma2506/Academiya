/**
 * Robust JSON extraction utility from messy LLM text output.
 * Ported from legacy/server/routes/ai.js as specified in reuse map.
 */
export function extractJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input must be a non-empty string');
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

  const parsed = JSON.parse(jsonStr);

  if (!isArray && parsed && typeof parsed === 'object') {
    if (parsed.question) return parsed.question;
    if (parsed.variants) return parsed.variants;
    if (parsed.diagnostic) return parsed.diagnostic;
    if (parsed.plan) return parsed.plan;
    if (parsed.explanation) return parsed.explanation;
  }

  return parsed;
}
