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
1. \`POST /media/upload\` — multipart, поле \`file\`. Фото/видео — профиль, пост, чат, задача. Документы (PDF, XLS, XLSX, DOC, DOCX) — только чат (\`?conversationId=\`) и задача (\`?taskId=\`). Для задачи: \`?kind=main\` (по умолчанию) или \`?kind=report\` — отчёт исполнителя. Ответ: публичный \`url\`.
2. \`PATCH /users/update\` — сохранить URL в \`avatar\`, \`banner\` и т.д.

### Посты с медиа
1. \`POST /posts\` — создать пост (без медиа). Для прямого назначения исполнителя без публикации: \`isPrivate: true\`.
2. \`POST /media/upload?postId={id}\` — загрузить файлы; они попадут в \`media[]\` поста.
3. \`GET /posts\` — посты других пользователей, доступные по роли (креатор → COMPANY, компания → CREATOR); приватные посты в общей ленте не показываются; \`?ownerId={свой id}\` — все свои посты (включая приватные); \`?isPrivate=\` — фильтр для своих; \`?q=\`, \`?title=\`, \`?isArchived=\`; доп. фильтры по полям поста (\`platforms\`, \`categories\`, \`budgetType\`, \`workFormat\`, \`createdDate\`, \`deadlineDate\` и др., массивы через запятую).
4. \`GET /posts/:id\` — пост по id; владелец видит всегда; приватный пост — только владелец (403 для остальных); публичный — по правилам типа поста.

### Избранное
1. \`POST /favorites/groups\` — создать группу (например, «спорт»).
2. \`POST /favorites\` — сохранить пост (\`postId\`, опционально \`groupId\`) или профиль (\`userId\` — креатор/компания).
3. \`GET /favorites\` — избранное; \`?type=POST\` (по умолчанию), \`CREATOR\`, \`COMPANY\`; для постов — \`?q=\`, \`?groupId=\` или \`?ungrouped=true\`.
4. \`PATCH /favorites/:postId\` — переместить пост в группу или groupId: null.
5. \`DELETE /favorites/users/:userId\` — убрать креатора/компанию из избранного.

### Отклики на посты
1. \`POST /applications\` — отклик (postId + message); на приватный пост откликнуться нельзя; создаёт сообщение в чате с владельцем поста; владельцу уходит email.
2. \`GET /applications/mine\` — мои отклики; \`?type=\`, \`?q=\`, \`?status=\`.
3. \`GET /applications/incoming\` — входящие на мои посты; \`?status=\`, \`?updatedDate=YYYY-MM-DD\`, \`?q=\` (название поста), \`?postId=\`, \`?type=\`.
4. \`GET /posts/:id/applications\` — отклики на конкретный пост (владелец).
5. \`PATCH /applications/:id/status\` — ACCEPTED создаёт задачу; REJECTED / VIEWED (владелец).

### Контрагенты (partners)
1. \`GET /partners/tasks/executors\` — **COMPANY**: уникальные креаторы-исполнители из задач (\`q\`, \`postId\`, \`taskId\`, \`userId\`, \`status\`/\`statuses\`, даты, \`sort\`).
2. \`GET /partners/tasks/customers\` — **CREATOR**: уникальные компании-заказчики из задач (те же фильтры).
3. \`GET /partners/applications/applicants\` — **COMPANY**: креаторы, откликавшиеся на посты (\`q\`, \`postId\`, \`userId\`, \`status\`/\`statuses\`, даты, \`sort\`).
4. \`GET /partners/applications/companies\` — **CREATOR**: компании, на посты которых откликался креатор (те же фильтры).

### Задачи
1. Создаются автоматически при \`PATCH /applications/:id/status\` → ACCEPTED (\`applicationId\` заполнен).
2. \`GET /tasks\` — список (\`?postId=\`, \`?role=owner|executor\`, \`?status=\`, \`?updatedDate=YYYY-MM-DD\`, \`?q=\` по title или companyName). У исполнителя в ответе нет блока \`post\`.
2a. \`GET /tasks/pending-approval\` — задачи исполнителя с \`isExecutorApprove: null\` (те же фильтры, кроме \`role\`).
2b. \`GET /tasks/activities\` — лента активностей по всем доступным задачам (\`?type=\`, \`?role=owner|executor\`, \`?taskId=\`).
2c. \`GET /tasks/comments\` — лента комментариев по всем доступным задачам (\`?role=owner|executor\`, \`?taskId=\`, \`?q=\`).
2d. \`GET /tasks/with-comments\` — задачи с комментариями: превью последнего, \`commentsCount\`, опционально \`unreadCount\` при \`readAfter\`.
3. \`POST /tasks\` — создать задачу вручную (владелец поста: \`postId\`, опционально \`executorId\`). Без отклика; \`applicationId\` = null. Исполнителя можно назначить позже через \`PATCH /tasks/:id\`.
4. \`GET /tasks/:id\` — задача с \`media[]\` (основные) и \`reportMedia[]\` (отчёт). Исполнитель не видит \`post\`.
5. \`PATCH /tasks/:id\` — owner: все поля (включая \`executorId\`); executor: только status. \`description\` — Markdown (хранится как строка).
6. \`DELETE /tasks/:id\` — удалить задачу (только owner поста).
7. Медиа задачи: \`POST /media/upload?taskId=\` (main), \`?taskId=&kind=report\` (отчёт), \`GET /tasks/:id/attachments\` (фильтры kind, type).
8. Комментарии: \`GET/POST /tasks/:id/comments\`, \`GET .../comments/search?q=\`, \`GET .../comments/attachments\`, \`PATCH/DELETE .../comments/:commentId\`. Вложения в комментарий: \`POST /media/upload?taskId=&forComment=true\`.

### Приватный пост + прямое назначение
1. Компания: \`POST /posts\` с \`isPrivate: true\` → медиа → \`POST /tasks\` с \`postId\` (и опционально \`executorId\`, либо назначить через \`PATCH /tasks/:id\`).
2. Креатор видит задачу в \`GET /tasks\`, но \`GET /posts/:id\` для приватного поста недоступен (403).

### Чат
- REST: список диалогов и история (сообщения с media[]).
- WebSocket \`/chat\`: realtime-сообщения (Socket.IO).
- Медиа: \`POST /media/upload?conversationId=\` → \`send_message\` с media[] (фото, видео, документы).
- 1:1 диалог между любыми пользователями.

### Сброс и проверка пароля
1. \`POST /auth/recovery-password\` — письмо на email Account.
2. Ссылка: \`{FRONTEND_URL}/reset-password?token=...\`
3. \`POST /auth/reset-password\` — новый пароль Account.
4. \`POST /auth/verify-password\` — проверка текущего пароля (авторизованный пользователь, перед сменой в настройках).

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
      'Регистрация, вход, профили Account, переключение, приглашения (invite), сброс и проверка пароля'
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
    .addTag(
      'partners',
      'Уникальные контрагенты: исполнители/заказчики из задач и откликов'
    )
    .addCookieAuth('access-token')
    .build();
}

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, createSwaggerConfig());
}
