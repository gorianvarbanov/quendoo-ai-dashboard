# 🔍 Competitor Price Scraper - Booking.com

## Обзор

Система за автоматично извличане на цени на конкуренти от Booking.com използвайки headless browser (Puppeteer + @sparticuz/chromium за Cloud Functions).

## 🎯 Възможности

- ✅ Извличане на реални цени от Booking.com в реално време
- ✅ Заобикаляне на anti-bot защита с Puppeteer headless browser
- ✅ Cloud Functions 2nd Gen с @sparticuz/chromium (оптимизиран за serverless)
- ✅ Автоматизиране през scheduled tasks
- ✅ AI анализ на конкурентни цени
- ✅ Автоматични имейл отчети

## 📦 Компоненти

### 1. Cloud Function: `scrapeBooking`
**Файл:** `functions/index.js`

**Endpoint:** `https://us-central1-quendoo-ai-dashboard.cloudfunctions.net/scrapeBooking`

**Метод:** POST

**Request Body:**
```json
{
  "url": "https://www.booking.com/hotel/bg/evrika.bg.html",
  "checkIn": "2026-07-13",
  "checkOut": "2026-07-19",
  "adults": 2,
  "children": 0,
  "rooms": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hotelName": "ДИТ Еврика Бийч Клуб Хотел - Ол Инклузив",
    "rating": null,
    "reviews": null,
    "availability": "available",
    "rooms": [
      {
        "name": "Стандартна стая с 1 двойно легло или с 2 отделни легла и балкон",
        "price": 1634,
        "currency": "$",
        "available": true,
        "bedType": null,
        "maxOccupancy": 2
      },
      {
        "name": "Премиум стая с изглед към морето",
        "price": 1987,
        "currency": "$",
        "available": true,
        "bedType": null,
        "maxOccupancy": 2
      }
    ],
    "prices": [1634, 1704, 1785, 1825, 1987, 2173, 2387, 2439, 901, 1660, 1741]
  },
  "scrapedAt": "2026-01-13T08:37:07.366Z",
  "url": "https://www.booking.com/hotel/bg/evrika.bg.html?checkin=2026-07-13&checkout=2026-07-19&group_adults=2&group_children=0&no_rooms=1"
}
```

### 2. MCP Tool: `scrape_competitor_prices`
**Файл:** `mcp-quendoo-chatbot/app/quendoo/tools.py`

**Достъпен в AI чата като:**
```
Scrape competitor prices from Booking.com
```

**Параметри:**
- `url` (required) - Booking.com URL на хотел
- `checkIn` (optional) - Дата на настаняване (YYYY-MM-DD)
- `checkOut` (optional) - Дата на напускане (YYYY-MM-DD)
- `adults` (optional) - Брой възрастни (default: 2)
- `children` (optional) - Брой деца (default: 0)
- `rooms` (optional) - Брой стаи (default: 1)

## 🚀 Deployment

### Стъпка 1: Инсталиране на dependencies
```bash
cd functions
npm install
```

### Стъпка 2: Deploy на Cloud Functions
```bash
firebase deploy --only functions:scrapeBooking
```

### Стъпка 3: Deploy на Python backend
```bash
# Deploy MCP server with new tool
# (вече е готов в tools.py)
```

## 📝 Примерна употреба

### Вариант 1: Директна заявка към Cloud Function
```bash
curl -X POST \
  https://us-central1-quendoo-ai-dashboard.cloudfunctions.net/scrapeBooking \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.booking.com/hotel/bg/evrika.bg.html",
    "checkIn": "2026-07-13",
    "checkOut": "2026-07-19",
    "adults": 2,
    "rooms": 1
  }'
```

### Вариант 2: Използване в AI Chat
```
Провери цените на конкурентния хотел Evrika за периода 13-19 юли 2026:
https://www.booking.com/hotel/bg/evrika.bg.html
```

AI автоматично ще използва tool-а `scrape_competitor_prices`.

### Вариант 3: Scheduled Task за автоматичен мониторинг

**Създай задача в Tasks dashboard:**

**Име:** Конкурентен анализ - Hotel Evrika

**Schedule:** `0 9 * * *` (всеки ден в 9:00)

**Стъпки:**
1. **scrape_competitor_prices**
   - url: `https://www.booking.com/hotel/bg/evrika.bg.html`
   - checkIn: `{TODAY+7}` (7 дни напред)
   - checkOut: `{TODAY+10}` (10 дни напред)

2. **analyze_data**
   - data: `{RESULT}` (от стъпка 1)
   - instruction: "Извлечи най-ниската и най-високата цена за стая. Сравни със собствените ни цени."
   - format: `html_table`

3. **send_quendoo_email**
   - to: `manager@hotel.com`
   - subject: `Конкурентен анализ - Цени Evrika`
   - message: `{RESULT}` (от стъпка 2)
   - html: `true`

## ⚙️ Конфигурация

### Environment Variables

**Python Backend (.env):**
```bash
SCRAPER_CLOUD_FUNCTION_URL=https://us-central1-quendoo-ai-dashboard.cloudfunctions.net/scrapeBooking
```

### Firebase Functions Memory
Scraper-ът използва 2GB RAM за Puppeteer + Chromium binary:
```javascript
memory: "2GiB"
```

### Timeout Settings
- Cloud Function timeout: 120 секунди
- Page navigation timeout: 30 секунди
- Wait for content: 3 секунди

### Технологии
- **Puppeteer-core** 23.x - Lightweight browser automation
- **@sparticuz/chromium** - Optimized Chromium binary за AWS Lambda/Cloud Functions
- **Firebase Functions** 2nd Gen (Cloud Run)

## 🔒 Ограничения и Best Practices

### Rate Limiting
- **Препоръка:** Не правете повече от 1 request на минута за същия хотел
- **Caching:** Резултатите се кешират за 1 час (бъдеща имплементация)

### Legal Compliance
- Използвайте само за конкурентен анализ
- Не препродавайте данните
- Спазвайте Terms of Service на Booking.com

### Anti-Bot Protection
- Scraper-ът използва реален User-Agent
- Случайни timeouts между заявки
- Ако Booking.com блокира IP, използвайте proxy (бъдеща функционалност)

## 🐛 Troubleshooting

### Грешка: "Bot detection challenge"
**Решение:** Cloud Function използва @sparticuz/chromium с реален User-Agent, което успешно заобикаля защитата.

### Грешка: "Timeout" или "Could not find Chrome"
**Решение:** Уверете се че използвате `puppeteer-core` + `@sparticuz/chromium` (не `playwright` или `puppeteer`):
```bash
npm install puppeteer-core @sparticuz/chromium
```

### Празни резултати
**Причина:** Booking.com променя HTML структурата често
**Решение:** Актуализирайте CSS selectors в `page.evaluate()` функцията

### Memory Issues
**Причина:** Chromium binary изисква минимум 2GB RAM
**Решение:** Уверете се че Cloud Function е конфигуриран с `memory: "2GiB"`

## 📊 Monitoring

### Cloud Functions Logs
```bash
firebase functions:log --only scrapeBooking
```

### Success Rate Tracking
Проверете Firestore collection `task_history` за статистика на изпълненията.

## 🔮 Бъдещи подобрения

- [ ] Proxy support за избягване на IP block
- [ ] Кеширане на резултати (Redis)
- [ ] Scraping на Airbnb, Expedia
- [ ] Исторически данни и тренд анализ
- [ ] Price alerts (известия при промяна на цени)
- [ ] Competitor dashboard в frontend

## 📞 Support

При проблеми:
1. Проверете Cloud Functions logs
2. Тествайте endpoint-а директно с curl
3. Проверете дали Playwright е инсталиран правилно

---

**Създадено:** 2026-01-13
**Автор:** Claude Sonnet 4.5 AI Assistant
