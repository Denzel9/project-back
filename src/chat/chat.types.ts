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
  updatedAt: Date;
};

export type JoinConversationPayload = {
  conversationId: string;
};

export type SendMessagePayload = {
  conversationId: string;
  content?: string;
  media?: ChatMessageMediaInput[];
};

export type ChatErrorPayload = {
  message: string;
};
