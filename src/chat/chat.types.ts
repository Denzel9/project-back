export type ChatMessageDto = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
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
  content: string;
};

export type ChatErrorPayload = {
  message: string;
};
