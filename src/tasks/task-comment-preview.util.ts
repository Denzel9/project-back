const COMMENT_PREVIEW_MAX_LENGTH = 200;

export function buildCommentPreview(content: string, hasMedia = false): string {
  const trimmed = content.trim();

  if (trimmed.length > 0) {
    if (trimmed.length <= COMMENT_PREVIEW_MAX_LENGTH) {
      return trimmed;
    }

    return `${trimmed.slice(0, COMMENT_PREVIEW_MAX_LENGTH - 1)}…`;
  }

  if (hasMedia) {
    return '[медиа]';
  }

  return '';
}

export function resolveTaskTitle(
  taskTitle: string | null,
  postTitle: string | null
): string | null {
  return taskTitle ?? postTitle ?? null;
}
