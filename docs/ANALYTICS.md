# Аналитика публикаций в социальных сетях

Система для сбора и анализа метрик публикаций в социальных сетях с автоматическим обновлением и расчетом ROI.

## 🎯 Возможности

- ✅ **Сбор метрик** из Instagram, VK, YouTube, TikTok, Telegram
- ✅ **Автоматическое обновление** каждые 6 часов для свежих публикаций
- ✅ **История метрик** с отслеживанием динамики
- ✅ **Расчет ROI** (Return on Investment)
- ✅ **Engagement Rate** и другие показатели эффективности

## 📊 Поддерживаемые метрики

| Метрика | Instagram | VK | YouTube | TikTok | Telegram |
|---------|-----------|----|---------| -------|----------|
| Просмотры | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Лайки | ✅ | ✅ | ✅ | ✅ | - |
| Комментарии | ✅ | ✅ | ✅ | ✅ | - |
| Репосты | ✅ | ✅ | - | ✅ | - |
| Сохранения | ✅ | - | - | ✅ | - |
| Охват | ✅ | ✅ | - | - | ✅ |
| Показы | ✅ | ✅ | - | - | - |
| Engagement Rate | ✅ | ✅ | ✅ | ✅ | - |

⚠️ - требует прав администратора канала

## 🚀 Быстрый старт

### 1. Настройка API ключей

Добавьте ключи API в `.env` файл:

```env
# YouTube
YOUTUBE_API_KEY=your_youtube_api_key

# Instagram (через Facebook App)
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret

# VK (опционально, для детальной статистики)
VK_SERVICE_TOKEN=your_service_token

# TikTok
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret

# Telegram (уже настроен для бота)
TELEGRAM_BOT_TOKEN=your_bot_token
```

### 2. Применить миграцию базы данных

```bash
npm run prisma:deploy
# или
npm run prisma:migrate
```

### 3. API Endpoints

#### Собрать аналитику вручную

```http
POST /publications/:publicationId/analytics/collect
Authorization: Bearer {token}
Content-Type: application/json

{
  "accessToken": "optional_platform_access_token"
}
```

#### Получить последнюю аналитику

```http
GET /publications/:publicationId/analytics/latest
Authorization: Bearer {token}
```

**Ответ:**
```json
{
  "id": "uuid",
  "publicationId": "uuid",
  "platform": "INSTAGRAM",
  "views": 15000,
  "likes": 1200,
  "comments": 45,
  "shares": 89,
  "saves": 234,
  "reach": 12000,
  "impressions": 18000,
  "followersGain": 120,
  "engagementRate": 8.5,
  "linkClicks": 345,
  "collectedAt": "2026-08-10T17:00:00.000Z",
  "createdAt": "2026-08-10T17:00:00.000Z"
}
```

#### История аналитики

```http
GET /publications/:publicationId/analytics/history?limit=30
Authorization: Bearer {token}
```

#### Расчет ROI

```http
POST /publications/:publicationId/analytics/roi
Authorization: Bearer {token}
Content-Type: application/json

{
  "campaignCost": 500
}
```

**Ответ:**
```json
{
  "campaignCost": 500,
  "estimatedValue": 750.5,
  "roi": 50.1,
  "cpe": 0.0417,
  "metrics": {
    "totalEngagement": 1334,
    "reach": 12000,
    "impressions": 18000,
    "engagementRate": 8.5
  }
}
```

## 🤖 Автоматическое обновление

Система автоматически обновляет метрики:

- **Каждые 6 часов** - для публикаций младше 7 дней
- **Раз в день** (3:00 AM) - для публикаций 7-30 дней
- **Раз в месяц** - очистка старой аналитики (>90 дней)

## 🔑 Получение Access Token

### Instagram

1. Создайте приложение на [developers.facebook.com](https://developers.facebook.com)
2. Добавьте продукт "Instagram"
3. Пройдите App Review для `instagram_content_publish` permission
4. Используйте Instagram User Access Token

**Пример получения токена:**
```javascript
// Frontend redirect
const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=instagram_basic,instagram_content_publish&response_type=code`;

// Backend exchange code for token
const response = await fetch('https://api.instagram.com/oauth/access_token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
    code: CODE
  })
});
```

### VK

1. Создайте приложение на [vk.com/apps](https://vk.com/apps?act=manage)
2. Получите Service Token для доступа к статистике сообществ

### YouTube

1. Создайте проект в [Google Cloud Console](https://console.cloud.google.com)
2. Включите YouTube Data API v3
3. Создайте API Key или OAuth credentials

### TikTok

1. Зарегистрируйтесь на [developers.tiktok.com](https://developers.tiktok.com)
2. Создайте приложение
3. Получите Client Key и Client Secret

### Telegram

Access token не требуется - используется существующий `TELEGRAM_BOT_TOKEN`.  
⚠️ Бот должен быть администратором канала для получения статистики.

## 📈 Расчет метрик

### Engagement Rate

```
ER = ((Likes + Comments + Shares) / Impressions) × 100
```

### ROI (Return on Investment)

```
ROI = ((Estimated Value - Campaign Cost) / Campaign Cost) × 100

Estimated Value = 
  Views × $0.01 +
  Likes × $0.05 +
  Comments × $0.10 +
  Shares × $0.15
```

### CPE (Cost Per Engagement)

```
CPE = Campaign Cost / Total Reach
```

## 🛠️ Разработка

### Добавление новой платформы

1. Создайте провайдер в `src/analytics/providers/`:

```typescript
import { Injectable } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { AnalyticsProviderInterface, SocialMediaMetrics } from '../analytics.types';

@Injectable()
export class NewPlatformAnalyticsProvider implements AnalyticsProviderInterface {
  getPlatform(): Platform {
    return Platform.NEW_PLATFORM;
  }

  isConfigured(): boolean {
    return true;
  }

  async fetchMetrics(postUrl: string, accessToken?: string): Promise<SocialMediaMetrics> {
    // Implement API integration
    return {
      views: 0,
      likes: 0,
      // ... other metrics
    };
  }
}
```

2. Добавьте в `analytics.module.ts`:

```typescript
providers: [
  // ...
  NewPlatformAnalyticsProvider,
],
```

3. Зарегистрируйте в `AnalyticsService`:

```typescript
constructor(
  // ...
  private readonly newPlatformProvider: NewPlatformAnalyticsProvider,
) {
  this.providers = new Map([
    // ...
    [Platform.NEW_PLATFORM, this.newPlatformProvider],
  ]);
}
```

## 📝 Примеры использования

### Frontend интеграция

```typescript
// Сбор аналитики
async function collectAnalytics(publicationId: string) {
  const response = await fetch(
    `/api/publications/${publicationId}/analytics/collect`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: instagramUserToken, // если требуется
      }),
    }
  );
  
  return response.json();
}

// Получение истории для графика
async function getAnalyticsChart(publicationId: string) {
  const response = await fetch(
    `/api/publications/${publicationId}/analytics/history?limit=30`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  
  const history = await response.json();
  
  // Отрисовка графика
  const chartData = history.map(item => ({
    date: new Date(item.collectedAt),
    views: item.views,
    likes: item.likes,
    engagementRate: item.engagementRate,
  }));
  
  return chartData;
}
```

## 🔒 Безопасность

- Access tokens хранятся только в памяти, не сохраняются в БД
- Доступ к аналитике только для участников задачи (owner/executor)
- Rate limiting для API запросов к соцсетям
- Валидация всех входных данных

## 🐛 Troubleshooting

### Ошибка "Access token не настроен"

Проверьте `.env` файл и убедитесь, что указаны необходимые ключи API.

### Ошибка "Некорректный URL поста"

Убедитесь, что URL публикации корректный:
- Instagram: `https://www.instagram.com/p/SHORTCODE/`
- VK: `https://vk.com/wall-123456_789`
- YouTube: `https://www.youtube.com/watch?v=VIDEO_ID`
- TikTok: `https://www.tiktok.com/@username/video/1234567890`
- Telegram: `https://t.me/channel_name/message_id`

### Метрики не обновляются автоматически

Проверьте логи cron задач:
```bash
# Просмотр логов приложения
docker-compose logs -f app | grep Analytics
```

## 📚 API Документация

Полная документация доступна в Swagger UI после запуска приложения:

```
http://localhost:3010/api/docs
```

## 🤝 Вклад

При добавлении новых провайдеров убедитесь, что:
- Реализован интерфейс `AnalyticsProviderInterface`
- Добавлены тесты
- Обновлена документация
- Добавлены примеры получения access token

## 📄 Лицензия

См. основной LICENSE файл проекта.
