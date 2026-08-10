# 📊 Аналитика публикаций

## Что реализовано

Полнофункциональная система сбора и анализа метрик публикаций в социальных сетях.

### ✨ Основные фичи

1. **Интеграции с 5 платформами:**
   - Instagram (через Meta Graph API)
   - VK (VK API)
   - YouTube (YouTube Data API v3)
   - TikTok (TikTok for Developers API)
   - Telegram (Bot API)

2. **Автоматический сбор метрик:**
   - Каждые 6 часов для свежих публикаций (< 7 дней)
   - Раз в день для старых публикаций (7-30 дней)
   - Автоматическая очистка старой аналитики (> 90 дней)

3. **API Endpoints:**
   - `POST /publications/:id/analytics/collect` - ручной сбор
   - `GET /publications/:id/analytics/latest` - последние метрики
   - `GET /publications/:id/analytics/history` - история для графиков
   - `POST /publications/:id/analytics/roi` - расчет ROI

4. **Метрики:**
   - Просмотры, лайки, комментарии, репосты, сохранения
   - Охват, показы
   - Прирост/потеря подписчиков
   - Engagement Rate
   - Клики по ссылкам
   - Время просмотра (для видео)

5. **ROI калькулятор:**
   - Автоматический расчет эффективности кампании
   - Cost Per Engagement (CPE)
   - Оценка ценности публикации

## 📁 Структура файлов

```
src/analytics/
├── analytics.module.ts               # Главный модуль
├── analytics.service.ts              # Основная логика
├── analytics.controller.ts           # API endpoints
├── analytics-scheduler.service.ts    # Cron задачи
├── analytics.types.ts                # Типы и интерфейсы
├── providers/                        # Провайдеры платформ
│   ├── instagram-analytics.provider.ts
│   ├── vk-analytics.provider.ts
│   ├── youtube-analytics.provider.ts
│   ├── tiktok-analytics.provider.ts
│   └── telegram-analytics.provider.ts
└── dto/                              # Data Transfer Objects
    ├── publication-analytics-response.dto.ts
    ├── roi-response.dto.ts
    └── analytics-query.dto.ts

prisma/
└── migrations/
    └── 20260810174800_add_publication_analytics/
        └── migration.sql              # Миграция БД

docs/
└── ANALYTICS.md                       # Подробная документация
```

## 🚀 Для запуска

1. **Применить миграцию:**
   ```bash
   npm run prisma:migrate
   ```

2. **Добавить API ключи в `.env`:**
   ```env
   YOUTUBE_API_KEY=your_key
   INSTAGRAM_APP_ID=your_id
   INSTAGRAM_APP_SECRET=your_secret
   # и т.д.
   ```

3. **Готово!** Cron задачи запустятся автоматически.

## 📖 Документация

Полная документация: [docs/ANALYTICS.md](./ANALYTICS.md)

## 🎯 Пример использования

```typescript
// Frontend
const response = await fetch(
  `/api/publications/${publicationId}/analytics/latest`
);
const analytics = await response.json();

console.log(analytics);
// {
//   views: 15000,
//   likes: 1200,
//   engagementRate: 8.5,
//   ...
// }
```

## 🔮 Что дальше?

Для использования на frontend нужно:
1. Создать компонент для отображения метрик
2. Добавить графики динамики (например, Chart.js)
3. UI для ручного обновления аналитики
4. Форму для расчета ROI

## 📝 Changelog

### v1.0.0 (2026-08-10)
- ✨ Добавлена система аналитики публикаций
- ✨ Интеграции с 5 социальными сетями
- ✨ Автоматическое обновление метрик
- ✨ ROI калькулятор
- 📝 Полная документация
