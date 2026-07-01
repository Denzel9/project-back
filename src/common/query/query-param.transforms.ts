export function transformCsvArray({
  value,
}: {
  value: unknown;
}): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map(String).map(item => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value === 'string') {
    const items = value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  return undefined;
}

export function transformOptionalBoolean({
  value,
}: {
  value: unknown;
}): boolean | undefined {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return value as boolean;
}

export function transformTrimmedString({
  value,
}: {
  value: unknown;
}): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
