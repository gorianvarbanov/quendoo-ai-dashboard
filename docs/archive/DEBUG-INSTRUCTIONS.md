# Debug Instructions - Какво "вижда" Scraper-ът

## Цел

Добавих debug код който ще покаже **точно какво HTML структура вижда Puppeteer** когато зарежда Booking.com страницата.

Това ще ни помогне да идентифицираме:
1. Правилните CSS selectors за room blocks
2. Защо scraper-ът не намира стаите
3. Каква е структурата на таблиците с цени

## Какво добавих

### 1. Screenshot на страницата
Scraper-ът прави screenshot на Booking.com страницата (базе64 кодиран).

### 2. HTML структура анализ

Логва следната информация:

```json
{
  "url": "https://www.booking.com/hotel/bg/park-madara.bg.html?...",
  "title": "Madara Park Hotel - All Inclusive",
  "bodyClasses": "...",

  "tables": [
    {
      "index": 0,
      "classes": "hprt-table",
      "dataAttributes": ["data-testid='room-table'"],
      "rowCount": 8,
      "hasPrice": true
    }
  ],

  "roomBlockSelectors": [
    {
      "selector": "[data-block-id]",
      "count": 5,
      "firstElementClasses": "hprt-table__row",
      "firstElementHtml": "<tr class='hprt-table__row' data-block-id='12345'>..."
    },
    {
      "selector": ".hprt-table tbody tr",
      "count": 8,
      "firstElementClasses": "...",
      "firstElementHtml": "..."
    }
  ],

  "bodyTextSample": "Madara Park Hotel - All Inclusive ... 544 лв ... 608 лв ..."
}
```

## Как да видиш debug информацията

### Стъпка 1: Тествай отново

1. Отвори чатбота: https://quendoo-ai-dashboard.web.app
2. Изпрати **НОВ** scrape request (с различни дати за да се избегне кешът):
   ```
   Scrape: https://www.booking.com/hotel/bg/park-madara.bg.html?checkin=2026-08-20&checkout=2026-08-24&group_adults=2&group_children=0&no_rooms=1
   ```

### Стъпка 2: Виж логовете

#### Вариант A: Firebase Console (препоръчвам)

1. Отвори: https://console.firebase.google.com/project/quendoo-ai-dashboard/functions/logs
2. Кликни на функцията **scrapeBooking**
3. Виж най-новите логове (refresh ако трябва)

#### Вариант B: Firebase CLI

```bash
firebase functions:log
```

### Стъпка 3: Намери debug съобщенията

Търси следните редове в логовете:

```
[DEBUG] Screenshot captured, size: XXXXX bytes
[DEBUG] Page structure: {
  "url": "...",
  "title": "...",
  "tables": [...],
  "roomBlockSelectors": [...],
  "bodyTextSample": "..."
}
```

### Стъпка 4: Копирай debug информацията

**Копирай цялата `[DEBUG] Page structure:` JSON част** и ми я изпрати.

Това ще покаже:
- ✅ Кои селектори намират стаи (`count` > 0)
- ✅ Какви са `class` атрибутите на room элементите
- ✅ Какви `data-*` атрибути има
- ✅ HTML структурата на първия room block
- ✅ Дали има таблици с цени

## Пример какво да очакваш

### Ако scraper-ът НАМИРА стаи:

```json
{
  "roomBlockSelectors": [
    {
      "selector": "[data-block-id]",
      "count": 8,  ← Намерени 8 стаи!
      "firstElementClasses": "hprt-table__row",
      "firstElementHtml": "<tr class='hprt-table__row' data-block-id='...'><td>..."
    }
  ]
}
```

### Ако scraper-ът НЕ НАМИРА стаи:

```json
{
  "roomBlockSelectors": [
    {
      "selector": "[data-block-id]",
      "count": 0,  ← Нула стаи с този selector!
      "firstElementClasses": null,
      "firstElementHtml": null
    },
    {
      "selector": ".hprt-table tbody tr",
      "count": 0,  ← Също нула!
      "firstElementClasses": null,
      "firstElementHtml": null
    }
  ],
  "tables": [
    {
      "index": 0,
      "classes": "some-new-class-name",  ← Booking.com използва НОВИ класове!
      "rowCount": 8,
      "hasPrice": true
    }
  ]
}
```

В този случай ще видим че:
- Старите селектори не работят (`count: 0`)
- Но има таблици с цени (`hasPrice: true`)
- Трябва да използваме новите `classes` за селектори

## Какво да ми изпратиш

1. **Screenshot от чатбота** (резултата след scraping)
2. **Copy-paste на `[DEBUG] Page structure:` JSON-а** от логовете

С тази информация ще мога да:
- ✅ Видя точно коя HTML структура използва Booking.com
- ✅ Напиша **правилните селектори** за room blocks
- ✅ Поправя scraper-а за да извлича стаите коректно

## Защо не виждам screenshot-а?

Screenshot-ът е base64 кодиран в логовете (много дълъг string). За да го видиш като изображение:

1. Намери реда: `[DEBUG] Screenshot captured, size: XXXXX bytes`
2. Следващият log entry ще съдържа base64 string-а
3. Копирай base64 string-а
4. Използвай онлайн tool: https://base64.guru/converter/decode/image
5. Paste base64 string-а и виж изображението

Но **JSON структурата е по-важна** - тя ще покаже директно кои селектори работят.

---

**Deployment:** 2026-01-24 15:15
**Status:** 🟢 Ready for testing
**Автор:** Claude Sonnet 4.5
