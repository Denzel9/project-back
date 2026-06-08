export const contactItemSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: [
        'phone',
        'telegram',
        'whatsapp',
        'instagram',
        'youtube',
        'vk',
        'website',
        'other',
      ],
    },
    value: { type: 'string', example: '+79991234567' },
    label: { type: 'string', nullable: true, example: 'WhatsApp' },
  },
  required: ['type', 'value'],
};

export const userResponseSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        role: { type: 'string', enum: ['CREATOR', 'COMPANY'] },
        membershipRole: {
          type: 'string',
          enum: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'],
        },
        contacts: {
          type: 'array',
          nullable: true,
          items: contactItemSchema,
        },
        phone: { type: 'string', nullable: true, example: '+79991234567' },
        location: { type: 'string', nullable: true },
        avatar: { type: 'string', nullable: true },
        bio: { type: 'string', nullable: true },
        followers: { type: 'number', example: 0 },
        aboutMe: { type: 'string', nullable: true },
        name: { type: 'string' },
        lastName: { type: 'string' },
        companyName: { type: 'string' },
      },
    },
  },
};
