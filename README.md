# yandex-tracker-mcp

MCP-сервер для [Yandex Tracker](https://tracker.yandex.ru/) API. Позволяет AI-ассистентам (Claude Code и совместимые клиенты) искать, читать, создавать и редактировать задачи, а также работать с комментариями, вложениями и связями в Yandex Tracker.

## Установка в проект через `.mcp.json`

Сервер подключается к **конкретному проекту Claude Code** через файл `.mcp.json` в корне проекта. OAuth-токен хранится локально в `~/.config/yandex-tracker-mcp/token.json` и подхватывается автоматически — в `.mcp.json` указывается только ID организации.

### Шаг 1. Получите OAuth-токен и ID организации

Откройте `https://tracker.yandex.ru/` и определите тип организации:

- **Яндекс 360 для бизнеса** — нужен `org-id` (узнать: `https://admin.yandex.ru/` → «Об организации»)
- **Yandex Cloud Organization** — нужен `cloud-org-id` (узнать: `https://console.yandex.cloud/` → «Все организации»)

Для получения OAuth-токена запустите один раз локально — откроется браузер с авторизацией, токен сохранится в `~/.config/yandex-tracker-mcp/token.json`:

```bash
npx -y yandex-tracker-mcp --org-id YOUR_ORG_ID --auth
# или
npx -y yandex-tracker-mcp --cloud-org-id YOUR_CLOUD_ORG_ID --auth
```

CLI использует встроенное OAuth-приложение `yandex-tracker-mcp` и проходит авторизацию по [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636) — без `client_secret`. Если вы хотите использовать собственное OAuth-приложение (корпоративная политика, отдельное логирование и т. п.), зарегистрируйте его на [oauth.yandex.ru](https://oauth.yandex.ru/) с Redirect URI `http://localhost:27311/callback` и правами `tracker:read`, `tracker:write`, после чего передайте `--client-id YOUR_APP_ID`.

Токен автоматически сохраняется в `~/.config/yandex-tracker-mcp/token.json` (права `0600`) и оттуда же читается при последующих запусках — `access_token` никуда копировать не нужно. При истечении срока сервер сам обновит его через `refresh_token`.

### Шаг 2. Создайте `.mcp.json` в корне проекта

Укажите `TRACKER_ORG_ID` (для Яндекс 360 для бизнеса) и `TRACKER_USERNAME` — имя и фамилию, по которым `search_issues` будет по умолчанию фильтровать задачи:

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp"],
      "env": {
        "TRACKER_ORG_ID": "1234567",
        "TRACKER_USERNAME": "Иван Иванов"
      }
    }
  }
}
```

Для Yandex Cloud Organization используйте `TRACKER_CLOUD_ORG_ID`:

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp"],
      "env": {
        "TRACKER_CLOUD_ORG_ID": "abc-xyz",
        "TRACKER_USERNAME": "Иван Иванов"
      }
    }
  }
}
```

ID организации — не секрет, поэтому `.mcp.json` можно коммитить. OAuth-токен в этом файле указывать не нужно: он лежит в `~/.config/yandex-tracker-mcp/token.json` и подхватывается автоматически.

**Фильтр по умолчанию.** `search_issues` автоматически добавляет к запросу `AND Assignee: "<TRACKER_USERNAME>"`. Чтобы найти задачи другого человека, скажи в промпте «найди задачи Петра Петрова» — модель передаст его имя параметром `assignee`, и фильтр по умолчанию будет заменён. Если в самом query уже есть `Assignee:`, автоподстановка пропускается.

### Шаг 3. Активируйте сервер в Claude Code

Запустите `claude` в корне проекта. При первом старте Claude Code попросит одобрить project-scoped MCP-серверы — подтвердите. Проверить статус можно командой `/mcp` внутри сессии.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `TRACKER_ORG_ID` | ID организации Яндекс 360 для бизнеса (заголовок `X-Org-ID`) |
| `TRACKER_CLOUD_ORG_ID` | ID Yandex Cloud Organization (заголовок `X-Cloud-Org-ID`) |
| `TRACKER_USERNAME` | Имя и фамилия для автоматического фильтра `Assignee:` в `search_issues`. Опционально |
| `TRACKER_OAUTH_TOKEN` | Опционально. Переопределяет токен из `~/.config/yandex-tracker-mcp/token.json` |

Указывайте ровно один из `TRACKER_ORG_ID` / `TRACKER_CLOUD_ORG_ID` — в зависимости от типа вашей организации.

## Доступные инструменты

| Инструмент | Описание |
|------------|----------|
| `get_issue` | Получить задачу по ключу (например `QUEUE-123`) |
| `search_issues` | Поиск задач на языке запросов Трекера (например `Queue: MYQUEUE AND Status: Open`) |
| `create_issue` | Создать новую задачу (очередь, название, описание, тип, приоритет, исполнитель и др.) |
| `update_issue` | Изменить существующую задачу (название, описание, приоритет, исполнитель и др.) |
| `get_transitions` | Получить доступные переходы статуса для задачи |
| `transition_issue` | Перевести задачу в другой статус (выполнить переход) |
| `get_comments` | Получить все комментарии к задаче |
| `get_attachments` | Получить метаданные вложений (имя, размер, MIME-тип, id) |
| `download_attachment` | Скачать вложение в base64. Изображения возвращаются как image-блоки |
| `get_issue_links` | Получить все связи задачи |
| `get_checklist` | Получить чеклист задачи |
| `get_statuses` | Получить список всех статусов |
| `get_issue_types` | Получить список типов задач (задача, баг, история и т.д.) |
| `get_resolutions` | Получить список резолюций |
| `get_priorities` | Получить список приоритетов |
| `get_queues` | Получить список очередей |
| `get_queue_local_fields` | Получить локальные (кастомные) поля очереди |
| `get_global_fields` | Получить глобальные (системные) поля |
| `get_entity` | Получить параметры сущности (проект, портфель) по типу и ID |

## Лицензия

MIT
