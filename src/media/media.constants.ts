export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const ALLOWED_ZIP_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
] as const;

export const ALLOWED_CSV_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'text/comma-separated-values',
] as const;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ...ALLOWED_ZIP_MIME_TYPES,
  ...ALLOWED_CSV_MIME_TYPES,
] as const;

export const ALLOWED_MEDIA_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
] as const;

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_TASK_REPORT_MEDIA = 30;

export const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-zip': 'zip',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'text/comma-separated-values': 'csv',
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
  csv: 'text/csv',
};

/** Canonical MIME from browser type or filename (zip/xls often come as aliases). */
export const resolveUploadMime = (
  mimetype?: string | null,
  originalName?: string | null
): string => {
  const raw = mimetype?.trim() || '';
  if (raw && (ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(raw)) {
    if ((ALLOWED_ZIP_MIME_TYPES as readonly string[]).includes(raw)) {
      return 'application/zip';
    }
    if ((ALLOWED_CSV_MIME_TYPES as readonly string[]).includes(raw)) {
      return 'text/csv';
    }
    return raw;
  }

  const ext = originalName?.replace(/^.*[/\\]/, '').split('.').pop()?.toLowerCase();
  if (ext && EXTENSION_TO_MIME[ext]) {
    return EXTENSION_TO_MIME[ext];
  }

  return raw;
};

/** Safe display name from multer `originalname` (path stripped, length capped). */
export const sanitizeUploadFileName = (
  originalName?: string | null
): string | null => {
  if (!originalName?.trim()) {
    return null;
  }

  const base = originalName
    .replace(/^.*[/\\]/, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();

  if (!base || base === '.' || base === '..') {
    return null;
  }

  return base.slice(0, 255);
};

export function isAllowedImageMime(mimetype: string): boolean {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimetype);
}

export function isAllowedVideoMime(mimetype: string): boolean {
  return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mimetype);
}

export function isAllowedDocumentMime(mimetype: string): boolean {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimetype);
}

export const ALLOWED_UPLOAD_TYPES_LABEL =
  'JPEG, PNG, WebP, GIF, MP4, WebM, MOV, PDF, XLS, XLSX, CSV, DOC, DOCX, ZIP';
