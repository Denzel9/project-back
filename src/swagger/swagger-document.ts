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
| **Membership** | Доступ Account к User: OWNER / ADMIN. |
| **User.role** | CREATOR / COMPANY / MANAGER. MANAGER — shell без витрины профиля; лента/чат/избранное доступны; публикация постов и отклики — после switch на COMPANY/CREATOR. |
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
1. \`POST /applications\` — отклик (postId + message); на приватный пост откликнуться нельзя; владельцу — in-app уведомление + email.
2. \`GET /applications/mine\` — мои отклики; \`?type=\`, \`?q=\`, \`?status=\`.
3. \`GET /applications/incoming\` — входящие на мои посты; \`?status=\`, \`?createdDate=YYYY-MM-DD\`, \`?q=\` (название поста), \`?postId=\`, \`?userId=\` (соискатель), \`?type=\`.
4. \`GET /posts/:id/applications\` — отклики на конкретный пост (владелец).
5. \`PATCH /applications/:id/status\` — ACCEPTED создаёт задачу; REJECTED / VIEWED (владелец).

### Контрагенты (partners)
1. \`GET /partners/tasks/executors\` — **COMPANY**: уникальные креаторы-исполнители из задач (\`q\`, \`postId\`, \`taskId\`, \`userId\`, \`status\`/\`statuses\`, даты, \`sort\`).
2. \`GET /partners/tasks/customers\` — **CREATOR**: уникальные компании-заказчики из задач (те же фильтры).
3. \`GET /partners/applications/applicants\` — **COMPANY**: креаторы, откликавшиеся на посты (\`q\`, \`postId\`, \`userId\`, \`status\`/\`statuses\`, даты, \`sort\`).
4. \`GET /partners/applications/companies\` — **CREATOR**: компании, на посты которых откликался креатор (те же фильтры).
5. Item: профиль + \`interactionsCount\`, \`lastInteractionAt\`, \`publicationsCount\` (без \`bio\`).

### Задачи
1. Создаются автоматически при \`PATCH /applications/:id/status\` → ACCEPTED (\`applicationId\` заполнен).
2. \`GET /tasks\` — список (\`?postId=\`, \`?role=owner|executor\`, \`?status=\`, \`?statuses=\`, \`?active=true\`, \`?excludeCompleted=true\`, \`?isCompanyAction=\`, \`?isExecutorApprove=true|false|null\`, \`?unassigned=true\`, \`?overdue=true\`, \`?urgent=true\`, \`?createdDate=YYYY-MM-DD\`, \`?dateFrom=\`/\`?dateTo=\` по \`createdAt\`, \`?q=\` по title или companyName). У исполнителя в ответе нет блока \`post\`.
2a. \`GET /tasks/pending-approval\` — задачи исполнителя с \`isExecutorApprove: null\` (те же фильтры, кроме \`role\`).
2b. \`GET /tasks/activities\` — лента активностей по всем доступным задачам (\`?type=\`, \`?role=owner|executor\`, \`?taskId=\`).
2c. \`GET /tasks/comments\` — лента комментариев по всем доступным задачам (\`?role=owner|executor\`, \`?taskId=\`, \`?q=\`).
2d. \`GET /tasks/with-comments\` — задачи с комментариями: превью последнего, \`commentsCount\`, \`unreadCount\` (по lastReadAt).
2e. \`GET /tasks/calendar\` — компактный список для календаря (id, даты, urgent, finalDate, title, owner, executor). Фильтры: \`dateFrom\`/\`dateTo\` + \`dateField=createdAt|updatedAt|finalDate\`, \`urgent\`, \`ownerId\`, \`executorId\`, \`role\`.
2f. \`GET /tasks/stats\` — счётчики для дашборда: \`awaitingAction\`, \`awaitingConfirmation\`, \`unassigned\`, \`overdue\`, \`urgent\`, \`underReview\`, \`cancelled\`. Фильтры: \`role\`, \`postId\`.
3. \`POST /tasks\` — создать задачу вручную (владелец поста: \`postId\`, опционально \`executorId\`). Без отклика; \`applicationId\` = null. Исполнителя можно назначить позже через \`PATCH /tasks/:id\`.
4. \`GET /tasks/:id\` — задача с \`media[]\` (основные) и \`reportMedia[]\` (отчёт). Комментарии — отдельно (\`GET /tasks/:id/comments\`). Исполнитель не видит \`post\`.
5. \`PATCH /tasks/:id\` — owner: все поля (включая \`executorId\`); executor: только status. \`description\` — Markdown (хранится как строка).
6. \`DELETE /tasks/:id\` — удалить задачу (только owner поста).
7. Медиа задачи: \`POST /media/upload?taskId=\` (main), \`?taskId=&kind=report\` (отчёт), \`GET /tasks/:id/attachments\` (фильтры kind, type).
8. Комментарии: \`GET/POST /tasks/:id/comments\`, \`POST .../comments/read\`, \`GET .../comments/search?q=\`, \`GET .../comments/attachments\`, \`PATCH/DELETE .../comments/:commentId\`. Поля: \`editedAt\`, \`isRead\`. Вложения: \`POST /media/upload?taskId=&forComment=true\`. Realtime — WebSocket \`/task-comments\`.
9. При переходе задачи в \`COMPLETED\` автоматически создаётся публикация (снимок \`reportMedia\` и метаданных задачи). См. раздел «Публикации».

### Публикации
1. Создаются **автоматически** при \`PATCH /tasks/:id\` → \`status: COMPLETED\` (снимок \`reportMedia\` и полей задачи). Ручного \`POST /publications\` нет.
2. \`GET /publications\` — список, где пользователь owner или executor (\`?role=owner|executor\`, \`?postId=\`, \`?taskId=\`, \`?ownerId=\`, \`?executorId=\`, \`?q=\` по title, \`?executorQ=\` по имени исполнителя, пагинация).
3. \`GET /publications/:id\` — детали + \`media[]\` + \`owner\` / \`executor\`.
4. \`PATCH /publications/:id\` — участники задачи: \`title\`, \`description\`, \`externalUrl\`, \`platform\`.

### Приватный пост + прямое назначение
1. Компания: \`POST /posts\` с \`isPrivate: true\` → медиа → \`POST /tasks\` с \`postId\` (и опционально \`executorId\`, либо назначить через \`PATCH /tasks/:id\`).
2. Исполнитель видит задачу в \`GET /tasks\`, но \`GET /posts/:id\` для приватного поста недоступен (403).

### Чат
- REST: список диалогов и история (сообщения с media[]).
- WebSocket \`/chat\`: realtime-сообщения (Socket.IO).
- Медиа: \`POST /media/upload?conversationId=\` → \`send_message\` с media[] (фото, видео, документы).
- 1:1 диалог между любыми пользователями.
- Новые сообщения — in-app уведомление + email (offline fallback).

### Уведомления
1. \`GET /notifications\` — inbox активного профиля (\`?read=true|false\`, \`?type=\`). Сортировка от новых к старым.
2. \`GET /notifications/unread-count\` — число непрочитанных.
3. \`PATCH /notifications/:id/read\` — пометить одно прочитанным.
4. \`PATCH /notifications/read-all\` — прочитать все.
5. WebSocket \`/notifications\`: при connect — комната \`user:{userId}\`; событие \`notification\` с телом уведомления и \`unreadCount\`.
6. Email через \`notify\` для всех типов уведомлений (отклики, задачи, чат, invite, публикации, отзыв доступа). \`TEAM_INVITE\` дополнительно шлёт специализированное invite-письмо со ссылкой.
7. Уведомления по типам: \`GET/PATCH /config\` → \`inAppNotificationTypes\` и \`emailNotificationTypes\` (whitelist; по умолчанию все типы).
8. \`CHAT_MESSAGE\` → email только если тип в email-whitelist, пользователь **offline** (нет WS \`/notifications\`) и не чаще 1 раза за 10 мин на диалог (throttle + дайджест). Окно: env \`CHAT_EMAIL_THROTTLE_MS\`.

Триггеры: новый/изменённый/отозванный отклик; создание/статус/исполнитель/комментарий/отчёт задачи; публикация по завершённой задаче; сообщение в чате; отзыв membership.

### Конфиг профиля
1. \`GET /config\` — конфиг активного User (lazy create с дефолтами).
2. \`PATCH /config\` — partial: \`inAppNotificationTypes\` / \`emailNotificationTypes\` (массивы \`NotificationType\`; пустой — канал выключен) и/или настройки дашборда CRM:
   - \`dashboardTiles\` — массив \`DashboardTileType\` в порядке отображения;
   - \`dashboardShowTasks\` / \`dashboardShowActivity\` / \`dashboardShowComments\` — видимость блоков;
   - \`dashboardShowCalendar\` / \`dashboardShowChats\` — persist only (без виджетов на дашборде пока).

### Сброс и проверка пароля
1. \`POST /auth/recovery-password\` — письмо на email Account.
2. Ссылка: \`{FRONTEND_URL}/reset-password?token=...\`
3. \`POST /auth/reset-password\` — новый пароль Account.
4. \`POST /auth/verify-password\` — проверка текущего пароля (авторизованный пользователь, перед сменой в настройках).

## WebSocket /chat

- URL: \`http://localhost:3010/chat\`, \`withCredentials: true\`.
- \`join_conversation\` → \`{ conversationId }\`
- \`send_message\` → \`{ conversationId, content?, media?, isRedirected? }\` (isRedirected: true при пересылке)
- \`edit_message\` → \`{ conversationId, messageId, content }\`
- \`delete_message\` → \`{ conversationId, messageId }\`
- \`mark_read\` → \`{ conversationId }\`
- Ответ: \`message\`, \`message_edited\`, \`message_deleted\`, \`messages_read\`, ошибки: \`error\`

## WebSocket /task-comments

- URL: \`http://localhost:3010/task-comments\`, \`withCredentials: true\` (auth как у \`/chat\`).
- \`join_task\` → \`{ taskId }\`
- \`send_comment\` → \`{ taskId, content?, media? }\`
- \`edit_comment\` → \`{ taskId, commentId, content }\`
- \`delete_comment\` → \`{ taskId, commentId }\`
- \`mark_comments_read\` → \`{ taskId }\`
- Ответ: \`comment\`, \`comment_edited\`, \`comment_deleted\` \`{ taskId, commentId }\`, \`comments_read\` \`{ taskId, userId, readAt }\`, ошибки: \`error\`
- REST-мутации комментариев тоже бродкастят эти события в комнату \`task:{taskId}\`.

## WebSocket /notifications

- URL: \`http://localhost:3010/notifications\`, \`withCredentials: true\`.
- При connect автоматически join в комнату пользователя.
- Событие: \`notification\` → \`{ notification, unreadCount }\`
- Ошибки: \`error\`
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
      'Задачи: автосоздание при ACCEPTED, owner/executor, комментарии (REST + WebSocket /task-comments)'
    )
    .addTag(
      'partners',
      'Уникальные контрагенты: исполнители/заказчики из задач и откликов'
    )
    .addTag(
      'notifications',
      'In-app уведомления: inbox, read/unread, WebSocket /notifications'
    )
    .addTag(
      'publications',
      'Публикации по завершённым задачам: автосоздание, снимок reportMedia, доступ owner/executor'
    )
    .addTag(
      'config',
      'Настройки профиля: уведомления и дашборд CRM (расширяемый UserConfig)'
    )
    .addCookieAuth('access-token')
    .build();
}

export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, createSwaggerConfig());
}
