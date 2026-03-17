# yandex-tracker-mcp

Read-only MCP-сервер для [Yandex Tracker](https://tracker.yandex.ru/) API. Позволяет AI-ассистентам (Claude Desktop, Claude Code, Cursor, ChatGPT и др.) искать и читать задачи, комментарии, вложения и связи из вашей организации в Yandex Tracker.

## Установка и использование

> **Важно:** Во всех примерах ниже используется `--org-id`. Выберите правильный флаг в зависимости от типа вашей организации:
> - `--org-id` — если Трекер привязан к организации **Яндекс 360 для бизнеса**
> - `--cloud-org-id` — если Трекер привязан к организации **Yandex Cloud Organization**
>
> Необходимо указать ровно один из двух.

### Claude Desktop

Добавьте в `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp", "--org-id", "YOUR_ORG_ID"]
    }
  }
}
```

Для организаций Yandex Cloud используйте `--cloud-org-id` вместо `--org-id`:

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp", "--cloud-org-id", "YOUR_CLOUD_ORG_ID"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add --scope user yandex-tracker -- npx -y yandex-tracker-mcp --org-id YOUR_ORG_ID
```

Для организаций Yandex Cloud:

```bash
claude mcp add --scope user yandex-tracker -- npx -y yandex-tracker-mcp --cloud-org-id YOUR_CLOUD_ORG_ID
```

### Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=yandex-tracker&config=eyJjb21tYW5kIjoibnB4IC15IHlhbmRleC10cmFja2VyLW1jcCAtLW9yZy1pZCBZT1VSX09SR19JRCJ9)

Или откройте Cursor Settings → MCP → Add new MCP server, или добавьте в `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": ["-y", "yandex-tracker-mcp", "--org-id", "YOUR_ORG_ID"]
    }
  }
}
```

### Codex

```bash
codex mcp add yandex-tracker -- npx -y yandex-tracker-mcp --org-id YOUR_ORG_ID
```

## Конфигурация

| Параметр | Описание |
|----------|----------|
| `--org-id <value>` | Идентификатор организации Яндекс 360 для бизнеса (заголовок `X-Org-ID`) |
| `--cloud-org-id <value>` | Идентификатор организации Yandex Cloud (заголовок `X-Cloud-Org-ID`) |

Необходимо указать ровно один из двух. При первом запуске сервер автоматически откроет браузер для авторизации через Yandex OAuth.

## Доступные инструменты

| Инструмент | Описание |
|------------|----------|
| `get_issue` | Получить задачу по ключу (например `QUEUE-123`) |
| `search_issues` | Поиск задач на языке запросов Трекера (например `Queue: MYQUEUE AND Status: Open`) |
| `get_comments` | Получить все комментарии к задаче |
| `get_attachments` | Получить метаданные вложений (имя, размер, MIME-тип, id) |
| `download_attachment` | Скачать вложение в base64. Изображения возвращаются как image-блоки |
| `get_issue_links` | Получить все связи задачи |

## Лицензия

MIT
