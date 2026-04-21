# yandex-tracker-mcp

MCP-сервер для [Yandex Tracker](https://tracker.yandex.ru/) API. Позволяет AI-ассистентам (Claude Code и совместимые клиенты) искать, читать, создавать и редактировать задачи, а также работать с комментариями, вложениями и связями в Yandex Tracker.

## Установка в проект через `.mcp.json`

Сервер подключается к **конкретному проекту Claude Code** через файл `.mcp.json` в корне проекта. Секреты (OAuth-токен, ID организации) прокидываются через блок `env` из переменных окружения разработчика — поэтому сам `.mcp.json` можно безопасно коммитить в репозиторий.

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

Затем скопируйте `access_token` из `~/.config/yandex-tracker-mcp/token.json`. Альтернатива — выпустить собственный OAuth-клиент на [oauth.yandex.ru](https://oauth.yandex.ru/) и получить токен вручную.

### Шаг 2. Экспортируйте переменные окружения

Добавьте в `~/.zshrc` / `~/.bashrc`:

```bash
export TRACKER_OAUTH_TOKEN="y0_xxx..."
export TRACKER_ORG_ID="1234567"
# либо, для Yandex Cloud Organization:
# export TRACKER_CLOUD_ORG_ID="abc-xyz"
```

Перезапустите терминал или выполните `source ~/.zshrc`.

### Шаг 3. Создайте `.mcp.json` в корне проекта

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp"],
      "env": {
        "TRACKER_OAUTH_TOKEN": "${TRACKER_OAUTH_TOKEN}",
        "TRACKER_ORG_ID": "${TRACKER_ORG_ID}"
      }
    }
  }
}
```

Для Yandex Cloud Organization замените `TRACKER_ORG_ID` на `TRACKER_CLOUD_ORG_ID` в обоих местах:

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp"],
      "env": {
        "TRACKER_OAUTH_TOKEN": "${TRACKER_OAUTH_TOKEN}",
        "TRACKER_CLOUD_ORG_ID": "${TRACKER_CLOUD_ORG_ID}"
      }
    }
  }
}
```

`.mcp.json` **можно коммитить**: файл содержит только имена переменных, а реальные значения подставляются из окружения каждого разработчика.

### Шаг 4. Активируйте сервер в Claude Code

Запустите `claude` в корне проекта. При первом старте Claude Code попросит одобрить project-scoped MCP-серверы — подтвердите. Проверить статус можно командой `/mcp` внутри сессии.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `TRACKER_OAUTH_TOKEN` | OAuth-токен Yandex для доступа к Tracker API |
| `TRACKER_ORG_ID` | ID организации Яндекс 360 для бизнеса (заголовок `X-Org-ID`) |
| `TRACKER_CLOUD_ORG_ID` | ID Yandex Cloud Organization (заголовок `X-Cloud-Org-ID`) |

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
