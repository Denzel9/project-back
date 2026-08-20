export type ChatMessageMediaDto = {
  url: string;
  key: string;
  size: string;
  mimeType: string;
  fileName: string | null;
};

export type ChatMessageMediaInput = {
  url: string;
  key: string;
  mimeType: string;
  size: number | string;
  fileName?: string | null;
};

export type ChatMessageDto = {
  id: string;
  conversationId: string;
  senderId: string;
  /** Account отправителя (логин владельца или менеджера) */
  actorAccountId: string | null;
  /** Снимок имени актёра на момент отправки */
  actorDisplayName: string | null;
  /** OWNER — основная компания/креатор; MANAGER — менеджер */
  actorKind: 'OWNER' | 'MANAGER' | null;
  content: string;
  media: ChatMessageMediaDto[];
  createdAt: Date;
  editedAt: Date | null;
  /** Переслано из другого диалога */
  isRedirected: boolean;
  redirectedFromUserId: string | null;
  redirectedFromDisplayName: string | null;
  replyToId: string | null;
  replyToPreview: string | null;
  replyToSenderId: string | null;
  replyToSenderName: string | null;
  /** Для входящих — прочитано текущим пользователем; для исходящих — прочитано собеседником */
  isRead: boolean;
};

export type ChatMessagesPageDto = {
  items: ChatMessageDto[];
  hasOlder: boolean;
  hasNewer: boolean;
};

export type ChatMessagePinDto = {
  messageId: string;
  content: string;
  mediaCount: number;
  scope: 'PERSONAL' | 'SHARED';
  pinnedAt: Date;
  pinnedById?: string;
  createdAt: Date;
  senderId: string;
  senderDisplayName: string;
  actorDisplayName: string | null;
  actorKind: 'OWNER' | 'MANAGER' | null;
};

export type ChatAttachmentDto = {
  id: string;
  messageId: string;
  senderId: string;
  url: string;
  key: string;
  size: string;
  mimeType: string;
  fileName: string | null;
  createdAt: Date;
};

export type ChatPeerDto = {
  id: string;
  role: string;
  avatar: string | null;
  displayName: string;
  isOnline: boolean;
  lastSeenAt: Date | null;
};

export type ChatPresencePayload = {
  userId: string;
  isOnline: boolean;
  lastSeenAt: string | null;
};

export type ChatConversationDto = {
  id: string;
  peer: ChatPeerDto;
  lastMessage: ChatMessageDto | null;
  unreadCount: number;
  unreadAnchorMessageId: string | null;
  isMarkedUnread: boolean;
  isPinned: boolean;
  isNotes: boolean;
  /** false — исполнитель ждёт первого сообщения от компании после отклика */
  canSendMessages: boolean;
  sendBlockedReason: string | null;
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

export type MessageHiddenPayload = {
  conversationId: string;
  messageIds: string[];
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
  redirectedFromUserId?: string;
  redirectedFromDisplayName?: string;
  replyToId?: string;
};

export type ChatErrorPayload = {
  message: string;
};
