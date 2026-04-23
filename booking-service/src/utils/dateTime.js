const UTC_OFFSET_RE = /(Z|[+-]\d{2}:\d{2})$/i;

function hasExplicitTimezone(value) {
  return UTC_OFFSET_RE.test(String(value).trim());
}

function normalizeUtcStringInput(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return '';

  const normalized = trimmed.includes(' ') ? trimmed.replace(' ', 'T') : trimmed;
  if (hasExplicitTimezone(normalized)) {
    return normalized;
  }

  return `${normalized}Z`;
}

function parseUtcInput(value, fieldName) {
  const normalized = normalizeUtcStringInput(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  // Enforce explicit timezone in API input to avoid browser/device-specific interpretation.
  if (!hasExplicitTimezone(String(value))) {
    throw new Error(`${fieldName} must include timezone offset (use UTC ISO format with Z)`);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }

  return parsed;
}

function toUtcIsoString(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  const normalized = normalizeUtcStringInput(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

module.exports = {
  parseUtcInput,
  toUtcIsoString,
  normalizeUtcStringInput
};
