export type TaskCommentMediaInput = {
  url: string;
  key: string;
  size: string;
  mimeType: string;
};

export type TaskCommentDto = {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  media: Array<{
    id: string;
    url: string;
    key: string;
    size: string;
    mimeType: string;
  }>;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  isRead: boolean;
};

export type JoinTaskPayload = {
  taskId: string;
};

export type SendCommentPayload = {
  taskId: string;
  content?: string;
  media?: TaskCommentMediaInput[];
  replyToId?: string;
};

export type EditCommentPayload = {
  taskId: string;
  commentId: string;
  content: string;
};

export type DeleteCommentPayload = {
  taskId: string;
  commentId: string;
};

export type MarkCommentsReadPayload = {
  taskId: string;
};

export type CommentDeletedPayload = {
  taskId: string;
  commentId: string;
};

export type CommentsReadPayload = {
  taskId: string;
  userId: string;
  readAt: string;
};

export type TaskCommentsErrorPayload = {
  message: string;
};
