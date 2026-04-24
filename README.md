# yandex-tracker-mcp

MCP-сервер для [Yandex Tracker](https://tracker.yandex.ru/) API. Позволяет AI-ассистентам (Claude Code и совместимые клиенты) искать, читать, создавать и редактировать задачи, а также работать с комментариями, вложениями и связями в Yandex Tracker.

## Подключение

Порядок одинаковый для любого MCP-клиента:

1. Получить OAuth-токен (один раз, локально).
2. Прописать сервер в конфиге клиента (JSON — Claude Code / Claude Desktop / Cursor, TOML — Codex).
3. Перезапустить клиент.

### Шаг 1. Получите OAuth-токен и ID организации

Откройте `https://tracker.yandex.ru/` и определите тип организации:

- **Яндекс 360 для бизнеса** — нужен `org-id` (узнать: `https://admin.yandex.ru/` → «Об организации»)
- **Yandex Cloud Organization** — нужен `cloud-org-id` (узнать: `https://console.yandex.cloud/` → «Все организации»)

Запустите один раз локально — откроется браузер с авторизацией Яндекса:

```bash
npx -y yandex-tracker-mcp --org-id YOUR_ORG_ID --auth
# или
npx -y yandex-tracker-mcp --cloud-org-id YOUR_CLOUD_ORG_ID --auth
```

CLI использует встроенное OAuth-приложение `yandex-tracker-mcp` и проходит авторизацию по [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636) — без `client_secret`. Если вы хотите использовать собственное OAuth-приложение (корпоративная политика, отдельное логирование и т. п.), зарегистрируйте его на [oauth.yandex.ru](https://oauth.yandex.ru/) с Redirect URI `http://localhost:27311/callback` и правами `tracker:read`, `tracker:write`, после чего передайте `--client-id YOUR_APP_ID`.

Токен автоматически сохраняется в `~/.config/yandex-tracker-mcp/token.json` (права `0600`) и оттуда же читается при последующих запусках — `access_token` никуда копировать не нужно. При истечении срока сервер сам обновит его через `refresh_token`.

### Шаг 2. Пропишите сервер в конфиге клиента

Все клиенты, кроме Codex, используют **одинаковый JSON-формат** `mcpServers`. Codex использует TOML. OAuth-токен в конфиге указывать **не нужно** — он читается из `~/.config/yandex-tracker-mcp/token.json` автоматически. `TRACKER_USERNAME` — имя-фамилия для фильтра `search_issues` по умолчанию (опционально).

Базовый пример для **Яндекс 360 для бизнеса**:

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

Для **Yandex Cloud Organization** замените `TRACKER_ORG_ID` на `TRACKER_CLOUD_ORG_ID` (значение — алфавитно-цифровой ID).

#### Claude Code

Путь конфига — `.mcp.json` в корне проекта (project-scoped, можно коммитить: ID организации не секрет). Положите в него JSON-пример выше.

Альтернатива через CLI (user-scoped, доступно во всех проектах). Stdio:

```bash
claude mcp add yandex-tracker --transport stdio \
  --env TRACKER_ORG_ID=1234567 \
  --env TRACKER_USERNAME="Иван Иванов" \
  -- npx -y yandex-tracker-mcp
```

На Windows (без WSL) `npx` требуется оборачивать в `cmd /c`: `-- cmd /c npx -y yandex-tracker-mcp`.

#### Claude Desktop

Settings → Developer → Edit Config, либо прямо откройте файл:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Положите туда тот же JSON-пример. Если файл пустой — используйте пример целиком. Если уже есть другие MCP-серверы — добавьте ключ `"yandex-tracker"` внутрь существующего `mcpServers`.

#### Cursor

Путь конфига:

- **Проект**: `.cursor/mcp.json` в корне проекта
- **Глобально**: `~/.cursor/mcp.json`

Формат — тот же JSON `mcpServers`. После сохранения Cursor подхватит сервер (или перезагрузите окно через `Cmd/Ctrl+Shift+P` → «Reload Window»).

#### Codex CLI / Codex IDE extension

Codex использует **TOML**. Путь конфига:

- **Глобально**: `~/.codex/config.toml`
- **Проект** (только для trusted-проектов): `.codex/config.toml`

```toml
[mcp_servers.yandex-tracker]
command = "npx"
args = ["-y", "yandex-tracker-mcp"]

[mcp_servers.yandex-tracker.env]
TRACKER_ORG_ID = "1234567"
TRACKER_USERNAME = "Иван Иванов"
```

Для Yandex Cloud Organization замените `TRACKER_ORG_ID` на `TRACKER_CLOUD_ORG_ID`.

```bash
codex mcp add yandex-tracker \
  --env TRACKER_ORG_ID=1234567 \
  --env TRACKER_USERNAME="Иван Иванов" \
  -- npx -y yandex-tracker-mcp
```

Один и тот же `config.toml` используется и CLI, и IDE-расширением Codex.

### Шаг 3. Перезапустите клиент и проверьте

- **Claude Code**: `claude` в корне проекта → подтвердите project-scoped MCP при первом запуске → `/mcp` покажет статус `connected`.
- **Claude Desktop**: полностью закройте приложение (Cmd+Q / из системного трея) и откройте заново. Индикатор MCP появится в правом нижнем углу поля ввода.
- **Cursor**: перезагрузите окно (`Cmd/Ctrl+Shift+P` → «Reload Window») либо Cursor целиком. В Settings → MCP сервер должен быть зелёным.
- **Codex CLI**: `codex mcp list` — сервер должен быть `connected`.

### Фильтр по умолчанию в `search_issues`

`search_issues` автоматически добавляет к запросу `AND Assignee: "<TRACKER_USERNAME>"`. Чтобы найти задачи другого человека, скажи в промпте «найди задачи Петра Петрова» — модель передаст его имя параметром `assignee`, и фильтр по умолчанию будет заменён. Если в самом query уже есть `Assignee:`, автоподстановка пропускается.

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
