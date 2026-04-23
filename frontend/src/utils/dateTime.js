const TZ_SUFFIX_RE = /(Z|[+-]\d{2}:\d{2})$/i;

export function normalizeUtcTimestamp(value) {
  if (!value) return '';

  const raw = String(value).trim();
  if (!raw) return '';

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  return TZ_SUFFIX_RE.test(normalized) ? normalized : `${normalized}Z`;
}

export function parseUtcDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = normalizeUtcTimestamp(value);
  if (!normalized) return null;

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toLocalDateTime(value, options = {}) {
  const parsed = parseUtcDate(value);
  if (!parsed) return '-';
  return parsed.toLocaleString([], options);
}

export function toLocalDateKey(value) {
  const parsed = parseUtcDate(value);
  if (!parsed) return '';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
