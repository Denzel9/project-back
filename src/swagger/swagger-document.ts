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

### Загрузка медиа
1. \`POST /media/upload\` — multipart, поле \`file\`. Фото/видео — профиль, пост, чат, задача. Документы (PDF, XLS, XLSX, DOC, DOCX) — только чат (\`?conversationId=\`) и задача (\`?taskId=\`). Ответ: публичный \`url\`.
2. \`PATCH /users/update\` — сохранить URL в \`avatar\`, \`banner\` и т.д.

### Посты с медиа
1. \`POST /posts\` — создать пост (без медиа).
2. \`POST /media/upload?postId={id}\` — загрузить файлы; они попадут в \`media[]\` поста.
3. \`GET /posts\` — все посты кроме своих; \`?q=\` — поиск по title или companyName; \`?ownerId=\`, \`?type=\`, \`?isArchived=\`.
4. \`GET /posts/:id\` — получить пост с \`media[].url\` для \`<img src>\`.

### Избранное
1. \`POST /favorites/groups\` — создать группу (например, «спорт»).
2. \`POST /favorites\` — сохранить пост (postId, опционально groupId).
3. \`GET /favorites\` — все избранные; \`?q=\` — поиск по title или companyName; \`?groupId=\` или \`?ungrouped=true\`.
4. \`PATCH /favorites/:postId\` — переместить в группу или groupId: null.

### Отклики на посты
1. \`POST /applications\` — отклик (postId + message); создаёт сообщение в чате с владельцем поста.
2. \`GET /applications/mine\` — мои отклики; \`?type=\`, \`?q=\`, \`?status=\`.
3. \`GET /applications/incoming\` — входящие на мои посты.
4. \`GET /posts/:id/applications\` — отклики на конкретный пост (владелец).
5. \`PATCH /applications/:id/status\` — ACCEPTED создаёт задачу; REJECTED / VIEWED (владелец).

### Задачи
1. Создаются автоматически при \`PATCH /applications/:id/status\` → ACCEPTED.
2. \`GET /tasks\` — список (\`?role=owner|executor\`, \`?status=\`, \`?updatedDate=YYYY-MM-DD\`, \`?q=\` по title или companyName).
3. \`GET /tasks/:id\` — задача с комментариями.
4. \`PATCH /tasks/:id\` — owner: все поля; executor: только status. \`description\` — Markdown (хранится как строка).
5. Комментарии: \`GET/POST /tasks/:id/comments\`, \`GET .../comments/search?q=\`, \`GET .../comments/attachments\`, \`PATCH/DELETE .../comments/:commentId\`.

### Чат
- REST: список диалогов и история (сообщения с media[]).
- WebSocket \`/chat\`: realtime-сообщения (Socket.IO).
- Медиа: \`POST /media/upload?conversationId=\` → \`send_message\` с media[] (фото, видео, документы).
- 1:1 диалог между любыми пользователями.

### Сброс пароля
1. \`POST /auth/recovery-password\` — письмо на email Account.
2. Ссылка: \`{FRONTEND_URL}/reset-password?token=...\`
3. \`POST /auth/reset-password\` — новый пароль Account.

## WebSocket /chat

- URL: \`http://localhost:3010/chat\`, \`withCredentials: true\`.
- \`join_conversation\` → \`{ conversationId }\`
- \`send_message\` → \`{ conversationId, content?, media? }\`
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
    .addTag(
      'media',
      'Загрузка в S3: фото/видео (профиль, пост, чат, задача); документы PDF/Office — чат и задача'
    )
    .addTag(
      'posts',
      'Посты creator/company: CRUD, media[] с публичными URL для фронта'
    )
    .addTag(
      'favorites',
      'Избранные посты активного профиля с группами (спорт и т.д.)'
    )
    .addTag(
      'applications',
      'Отклики на посты: mine, incoming, статусы NEW/VIEWED/ACCEPTED/REJECTED'
    )
    .addTag(
      'tasks',
      'Задачи: автосоздание при ACCEPTED, owner/executor, комментарии'
    )
    .addCookieAuth('access-token')
    .build();
}

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, createSwaggerConfig());
}
