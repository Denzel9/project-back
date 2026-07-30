export type ChatMessageMediaDto = {
  url: string;
  key: string;
  size: string;
  mimeType: string;
};

export type ChatMessageMediaInput = {
  url: string;
  key: string;
  mimeType: string;
  size: number | string;
};

export type ChatMessageDto = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  media: ChatMessageMediaDto[];
  createdAt: Date;
  editedAt: Date | null;
  /** Переслано из другого диалога */
  isRedirected: boolean;
  /** Для входящих — прочитано текущим пользователем; для исходящих — прочитано собеседником */
  isRead: boolean;
};

export type ChatAttachmentDto = {
  id: string;
  messageId: string;
  senderId: string;
  url: string;
  key: string;
  size: string;
  mimeType: string;
  createdAt: Date;
};

export type ChatPeerDto = {
  id: string;
  role: string;
  avatar: string | null;
  displayName: string;
};

export type ChatConversationDto = {
  id: string;
  peer: ChatPeerDto;
  lastMessage: ChatMessageDto | null;
  unreadCount: number;
  updatedAt: Date;
};

export type JoinConversationPayload = {
  conversationId: string;
};

export type MarkReadPayload = {
  conversationId: string;
};

export type DeleteMessagePayload = {
  conversationId: string;
  messageId: string;
};

export type EditMessagePayload = {
  conversationId: string;
  messageId: string;
  content: string;
};

export type MessageDeletedPayload = {
  conversationId: string;
  messageId: string;
};

export type MessagesReadPayload = {
  conversationId: string;
  userId: string;
  readAt: string;
};

export type SendMessagePayload = {
  conversationId: string;
  content?: string;
  media?: ChatMessageMediaInput[];
  /** true при пересылке сообщения из другого диалога */
  isRedirected?: boolean;
};

export type ChatErrorPayload = {
  message: string;
};
