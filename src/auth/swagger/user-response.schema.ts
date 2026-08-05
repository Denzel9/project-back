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

export const personSchema = {
  type: 'object',
  nullable: true,
  properties: {
    name: { type: 'string', nullable: true, example: 'Ivan' },
    lastName: { type: 'string', nullable: true, example: 'Ivanov' },
    height: { type: 'string', nullable: true, example: '180' },
    weight: { type: 'string', nullable: true, example: '75' },
    size: { type: 'string', nullable: true, example: 'M' },
    birthday: { type: 'string', nullable: true, example: '1995-06-15' },
    gender: { type: 'string', nullable: true, example: 'male' },
    parameters: { type: 'string', nullable: true, example: '90-60-90' },
  },
};

export const userResponseSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        role: { type: 'string', enum: ['CREATOR', 'COMPANY', 'MANAGER'] },
        membershipRole: {
          type: 'string',
          enum: ['OWNER', 'ADMIN'],
        },
        contacts: {
          type: 'array',
          nullable: true,
          items: contactItemSchema,
        },
        person: personSchema,
        phone: { type: 'string', nullable: true, example: '+79991234567' },
        location: { type: 'string', nullable: true },
        avatar: { type: 'string', nullable: true },
        bio: { type: 'string', nullable: true },
        isVerified: {
          type: 'boolean',
          description: 'Профиль проверен платформой',
        },
        followers: {
          type: 'number',
          description:
            'Сколько пользователей добавили этого пользователя в избранное',
        },
        completedTasksCount: {
          type: 'number',
          description:
            'Кол-во завершённых задач (как владелец или исполнитель)',
        },
        isEmailConfirmed: {
          type: 'boolean',
          description: 'Email профиля (User.email) подтверждён',
        },
        aboutMe: { type: 'string', nullable: true },
        name: { type: 'string' },
        lastName: { type: 'string' },
        companyName: { type: 'string' },
      },
    },
  },
};
