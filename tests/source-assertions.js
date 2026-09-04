'use strict';

function compactWhitespace(value) {
  return String(value).replace(/\s+/g, '');
}

function textIncludes(value, expected, position) {
  if (value == null || typeof value.includes !== 'function') {
    throw new TypeError('textIncludes expects a value that supports includes().');
  }

  if (typeof value !== 'string' || position !== undefined) {
    return value.includes(expected, position);
  }

  const compactValue = compactWhitespace(value);
  const compactExpected = compactWhitespace(expected);

  if (compactValue.includes(compactExpected)) return true;

  // CSS formatters commonly add an optional trailing semicolon before `}`.
  // Treat that stylistic difference as equivalent for source-level assertions.
  if (compactExpected.includes('{') || compactExpected.includes('}')) {
    const normalizedValue = compactValue.replace(/;}/g, '}');
    const normalizedExpected = compactExpected.replace(/;}/g, '}');
    return normalizedValue.includes(normalizedExpected);
  }

  return false;
}

function compactSlice(source, startMarker, endMarker) {
  const compactSource = compactWhitespace(source);
  const compactStart = compactWhitespace(startMarker);
  const compactEnd = compactWhitespace(endMarker);
  const start = compactSource.indexOf(compactStart);

  if (start < 0) return '';

  const end = compactSource.indexOf(compactEnd, start + compactStart.length);
  return end < 0 ? compactSource.slice(start) : compactSource.slice(start, end);
}

module.exports = {
  compactWhitespace,
  textIncludes,
  compactSlice,
};
