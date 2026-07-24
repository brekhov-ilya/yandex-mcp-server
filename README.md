# yandex-tracker-mcp

MCP-сервер для [Yandex Tracker](https://tracker.yandex.ru/) API. Позволяет AI-ассистентам (Claude Code и совместимые клиенты) искать, читать, создавать и редактировать задачи, а также работать с комментариями, вложениями и связями в Yandex Tracker.

## Подключение

Сервер можно использовать двумя способами:

- **Локально (stdio)** — клиент сам запускает `npx -y yandex-tracker-mcp` как дочерний процесс. Токен и организация фиксируются один раз в конфиге клиента или локальном auth-файле. Подходит для личного использования на своей машине. Описано ниже в этом разделе.
- **Удалённо (HTTP)** — сервер поднят один раз на общей инфраструктуре (см. [«Удалённое подключение (HTTP)»](#удалённое-подключение-http)), а каждый клиент подключается по сети под своим личным Yandex-токеном, передаваемым в заголовке запроса. Подходит для команды — не нужно, чтобы у каждого локально стоял Node.js/npx.

### Локальное подключение (stdio)

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

### Фильтры по умолчанию

`search_issues` автоматически добавляет к TQL-запросу:

- `AND Assignee: "<TRACKER_USERNAME>"` — если задано и в query нет `Assignee:`.
- `AND Queue: <TRACKER_DEFAULT_QUEUE>` — если задано и в query нет `Queue:`.
- `AND Project: <TRACKER_DEFAULT_PROJECT>` — если задано и в query нет `Project:`.

Любое явное упоминание соответствующего поля в самом query отключает автоподстановку. Параметр `assignee` при вызове `search_issues` тоже переопределяет дефолт.

`create_issue` подставляет `TRACKER_DEFAULT_QUEUE` и `TRACKER_DEFAULT_PROJECT`, если соответствующие параметры не переданы. `update_issue` подставляет только `TRACKER_DEFAULT_PROJECT` (при явном отсутствии поля). `get_queue_local_fields` принимает `queueKey` опционально и фолбэчится на `TRACKER_DEFAULT_QUEUE`.

### ФИО → login

В полях `assignee` и `followers` (`create_issue`, `update_issue`) можно передавать ФИО на русском — сервер сам резолвит их в login через справочник `/v3/users`. Для явного поиска пользователя используйте `find_user` — он принимает подстроку имени, login или email и возвращает `[{login, display, email}]`.

### Любые поля задачи (глобальные и кастомные)

`create_issue` и `update_issue` принимают параметр `fields` — карту `ключ_поля → значение` для любых глобальных и локальных (кастомных) полей очереди (например «QA-инженер», «Документация»). Ключи полей берутся из `get_global_fields` и `get_queue_local_fields`.

Значения указываются в формате Трекера: select → ключ опции, дата → `"YYYY-MM-DD"`, пользователь → login, множественные → массив.

Для полей с типом «пользователь» можно передать ФИО и перечислить их ключи в `userFields` — сервер сам преобразует ФИО в login (как для `assignee`).

```jsonc
// create_issue
{
  "summary": "Подключить интеграцию",
  "fields": {
    "qaEngineer": "Иван Иванов",     // ФИО — будет резолвлено в login
    "documentation": "https://wiki/...",
    "deadline": "2026-07-01"
  },
  "userFields": ["qaEngineer"]
}
```

## Удалённое подключение (HTTP)

Вместо запуска `npx` локально сервер можно один раз поднять на своей инфраструктуре (VPS, Docker) и подключаться к нему по сети из нескольких клиентов и машин. Каждый пользователь работает под **своим личным** Yandex-токеном — сервер не хранит общий токен на всех, токен передаётся в заголовке каждого запроса.

### Модель авторизации

- Организация (`TRACKER_ORG_ID`/`TRACKER_CLOUD_ORG_ID`) настраивается один раз на сервере (в `.env`/`docker-compose.yml`) и общая для всей команды.
- Личный OAuth-токен передаётся в заголовке `Authorization: OAuth <token>` (или `Bearer <token>`) при каждом запросе — сервер не хранит и не резолвит его сам, в отличие от stdio-режима.
- Имя для дефолтного фильтра `Assignee:` в `search_issues` резолвится автоматически по токену через `/v3/myself` — отдельный заголовок с ФИО не нужен.
- При желании конкретный запрос может переопределить организацию заголовками `X-Org-Id`/`X-Cloud-Org-Id` (например если сервер обслуживает несколько организаций).
- Единственный секрет в этой схеме — сам личный Tracker-токен.

### Разворачивание сервера (Docker, по IP без домена)

Основной вариант — без домена и без TLS, сервер публикуется прямо по `http://IP-СЕРВЕРА:3000/mcp`:

1. Скопируйте `.env.example` в `.env`, заполните `TRACKER_ORG_ID` (или `TRACKER_CLOUD_ORG_ID`) и при необходимости `TRACKER_DEFAULT_QUEUE`/`TRACKER_DEFAULT_PROJECT`.
2. `docker compose up -d --build`.

Сервер начнёт слушать `http://IP-СЕРВЕРА:3000/mcp`.

**Важно:** личный OAuth-токен идёт в заголовке `Authorization` в открытом виде — без TLS его может перехватить любой, кто видит трафик между клиентом и сервером. Такой вариант годится только тогда, когда сервер **не торчит в публичный интернет напрямую** — держите порт 3000 закрытым firewall'ом (allowlist по IP команды) или разворачивайте сервер внутри VPN, доступного только вашей команде.

Если сервер всё же должен быть доступен из открытого интернета, используйте вариант с доменом и HTTPS ниже.

<details>
<summary>Опционально: HTTPS через домен (или бесплатный sslip.io) вместо голого HTTP</summary>

В репозитории есть `docker-compose.https.yml` и `Caddyfile` — Caddy в роли reverse-proxy с автоматическим HTTPS от Let's Encrypt:

1. В `Caddyfile` замените `mcp.example.com` на реальный домен, у которого A/AAAA-запись указывает на IP сервера. Своего домена нет — подойдёт бесплатный IP-based хост вида `203-0-113-5.sslip.io` (замените точки в вашем IP на дефисы) — Caddy получит для него настоящий сертификат Let's Encrypt без покупки домена.
2. `docker compose -f docker-compose.https.yml up -d --build` (вместо обычного `docker-compose.yml`).

Сервер начнёт слушать `https://ваш-домен/mcp`, порт 3000 наружу при этом не публикуется — только через Caddy.

</details>

### Получение личного токена

Тот же PKCE-флоу, что и для локального режима — выполняется один раз на своей машине (нужен браузер):

```bash
npx -y yandex-tracker-mcp --org-id YOUR_ORG_ID --auth
```

Токен сохранится в `~/.config/yandex-tracker-mcp/token.json` — возьмите значение поля `access_token` и используйте его как значение заголовка `Authorization` в конфиге клиента ниже.

### Конфиг клиента

Ниже — адрес для варианта «по IP без домена» (`http://IP-СЕРВЕРА:3000/mcp`). Если разворачивали опциональный вариант с Caddy/доменом, используйте вместо него `https://ваш-домен/mcp`.

#### Claude Code

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "type": "http",
      "url": "http://IP-СЕРВЕРА:3000/mcp",
      "headers": {
        "Authorization": "OAuth YOUR_PERSONAL_TOKEN"
      }
    }
  }
}
```

Либо через CLI:

```bash
claude mcp add --transport http yandex-tracker http://IP-СЕРВЕРА:3000/mcp \
  --header "Authorization: OAuth YOUR_PERSONAL_TOKEN"
```

#### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.yandex-tracker]
url = "http://IP-СЕРВЕРА:3000/mcp"
bearer_token_env_var = "TRACKER_OAUTH_TOKEN"
```

`bearer_token_env_var` — имя переменной окружения, из которой Codex возьмёт токен при старте (например `export TRACKER_OAUTH_TOKEN=YOUR_PERSONAL_TOKEN`), сам токен в файл не пишется.

#### Claude Desktop

`claude_desktop_config.json` не умеет задавать произвольные заголовки для удалённого HTTP-сервера напрямую — используйте локальный stdio-мост [`mcp-remote`](https://www.npmjs.com/package/mcp-remote), который сам прокидывает заголовки на удалённый URL:

```json
{
  "mcpServers": {
    "yandex-tracker": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "http://IP-СЕРВЕРА:3000/mcp",
        "--header", "Authorization: OAuth YOUR_PERSONAL_TOKEN"
      ]
    }
  }
}
```

### Проверка

```bash
curl -i http://IP-СЕРВЕРА:3000/mcp \
  -H "Authorization: OAuth YOUR_PERSONAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Без заголовка `Authorization` сервер вернёт `401`; без `X-Org-Id`/`X-Cloud-Org-Id` и без серверного дефолта (`TRACKER_ORG_ID`/`TRACKER_CLOUD_ORG_ID` в `.env`) — `400`.

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `TRACKER_ORG_ID` | ID организации Яндекс 360 для бизнеса (заголовок `X-Org-ID`). В HTTP-режиме — дефолт, если запрос не передал `X-Org-Id` сам |
| `TRACKER_CLOUD_ORG_ID` | ID Yandex Cloud Organization (заголовок `X-Cloud-Org-ID`). В HTTP-режиме — дефолт, если запрос не передал `X-Cloud-Org-Id` сам |
| `TRACKER_USERNAME` | Имя и фамилия для автоматического фильтра `Assignee:` в `search_issues`. Опционально. Используется только в stdio-режиме — в HTTP-режиме резолвится автоматически по токену через `/v3/myself` |
| `TRACKER_DEFAULT_QUEUE` | Очередь по умолчанию. Используется в `search_issues` (TQL `Queue:`), `create_issue` (поле `queue`), `get_queue_local_fields` (поле `queueKey`). Опционально |
| `TRACKER_DEFAULT_PROJECT` | Проект по умолчанию. Числовой `shortId`. Используется в `search_issues` (TQL `Project:`), `create_issue` / `update_issue` (поле `project` в формате v3 `{primary:{shortId}}`). Опционально. Нечисловое значение применяется только в TQL-фильтре |
| `TRACKER_OAUTH_TOKEN` | Опционально. Переопределяет токен из `~/.config/yandex-tracker-mcp/token.json`. Используется только в stdio-режиме — в HTTP-режиме токен всегда берётся из заголовка `Authorization` каждого запроса |

Указывайте ровно один из `TRACKER_ORG_ID` / `TRACKER_CLOUD_ORG_ID` — в зависимости от типа вашей организации.

## Доступные инструменты

| Инструмент | Описание |
|------------|----------|
| `get_issue` | Получить задачу по ключу (например `QUEUE-123`) |
| `search_issues` | Поиск задач на языке запросов Трекера (например `Queue: MYQUEUE AND Status: Open`) |
| `create_issue` | Создать новую задачу (очередь, название, описание, тип, приоритет, исполнитель и др., плюс любые глобальные/кастомные поля через `fields`) |
| `update_issue` | Изменить существующую задачу (название, описание, приоритет, исполнитель и др., плюс любые глобальные/кастомные поля через `fields`) |
| `get_transitions` | Получить доступные переходы статуса для задачи |
| `transition_issue` | Перевести задачу в другой статус (выполнить переход) |
| `get_comments` | Получить все комментарии к задаче |
| `create_comment` | Добавить комментарий к задаче (с поддержкой `summonees` — упоминаний и `attachmentIds`) |
| `update_comment` | Отредактировать комментарий (`text`, `summonees`, `attachmentIds`) |
| `get_attachments` | Получить метаданные вложений (имя, размер, MIME-тип, id) |
| `download_attachment` | Скачать вложение в base64. Изображения возвращаются как image-блоки |
| `get_issue_links` | Получить все связи задачи |
| `create_issue_link` | Создать связь между задачами (`relates`, `depends on`, `is dependent by`, `duplicates`, `is subtask for` и др.) |
| `get_checklist` | Получить чеклист задачи |
| `get_statuses` | Получить список всех статусов |
| `get_issue_types` | Получить список типов задач (задача, баг, история и т.д.) |
| `get_resolutions` | Получить список резолюций |
| `get_priorities` | Получить список приоритетов |
| `get_queues` | Получить список очередей |
| `get_queue_local_fields` | Получить локальные (кастомные) поля очереди |
| `get_global_fields` | Получить глобальные (системные) поля |
| `get_entity` | Получить параметры сущности (проект, портфель) по типу и ID |
| `find_user` | Найти пользователей по подстроке ФИО, login или email. Возвращает `[{login, display, email}]` |

## Лицензия

MIT
