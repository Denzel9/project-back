import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

const API_DESCRIPTION = `
# Project Back API

Backend для marketplace creator ↔ company. Документация для фронтенда и AI-ассистентов.

## Модель данных

| Сущность | Что это |
|----------|---------|
| **Account** | Login: email + password. Один человек = один Account. |
| **User** | Публичный профиль: CREATOR или COMPANY. При регистрации создаётся один User на Account. |
| **Membership** | Доступ Account к User: OWNER / ADMIN / EDITOR / VIEWER. |
| **Invite** | Приглашение другому человеку управлять **существующим** профилем. |

**Активный профиль** — тот, чей \`userId\` в JWT (\`sub\`). Переключение: \`POST /auth/switch-profile\`.

## Cookies и CORS

- После login/register/refresh выставляются httpOnly cookies: \`access-token\`, \`refresh-token\`.
- Все запросы с \`credentials: 'include'\`.
- CORS origin: \`CORS_ORIGIN\` (обычно http://localhost:3000).

## Сценарии

### Первый вход
1. \`POST /auth/register/creator\` или \`/auth/register/company\` — создаёт Account + первый профиль.
2. \`POST /auth/login\` — вход по email/password.

### Совместное управление (менеджер)
1. Владелец: \`POST /auth/invites\` — email менеджера + \`userId\` **существующего** профиля + роль.
2. Менеджер: регистрация/логин **своим** email → \`POST /auth/invites/accept\`.
3. Менеджер: \`GET /auth/profiles\` → \`POST /auth/switch-profile\`.

### Редактирование профиля
- \`PATCH /users/update\` — единственный эндпоинт обновления (поля User + name/companyName по роли).
- VIEWER не может редактировать (403).

### Чат
- REST: список диалогов и история.
- WebSocket \`/chat\`: realtime-сообщения (Socket.IO).
- Только 1:1 между CREATOR и COMPANY.

### Сброс пароля
1. \`POST /auth/recovery-password\` — письмо на email Account.
2. Ссылка: \`{FRONTEND_URL}/reset-password?token=...\`
3. \`POST /auth/reset-password\` — новый пароль Account.

## WebSocket /chat

- URL: \`http://localhost:3010/chat\`, \`withCredentials: true\`.
- \`join_conversation\` → \`{ conversationId }\`
- \`send_message\` → \`{ conversationId, content }\`
- Ответ: \`message\`, ошибки: \`error\`
`.trim();

export function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Project Back API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0')
    .addServer('http://localhost:3010', 'Локальная разработка')
    .addTag(
      'auth',
      'Регистрация, вход, профили Account, переключение, приглашения (invite), сброс пароля'
    )
    .addTag(
      'users',
      'Публичный профиль User: просмотр по id, редактирование активного профиля'
    )
    .addTag('creator', 'Эндпоинты только для активного профиля с ролью CREATOR')
    .addTag('company', 'Эндпоинты только для активного профиля с ролью COMPANY')
    .addTag(
      'chat',
      'Личные сообщения creator ↔ company (REST). Realtime — WebSocket /chat'
    )
    .addCookieAuth('access-token')
    .build();
}

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, createSwaggerConfig());
}
