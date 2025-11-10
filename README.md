# 🚀 Инструкция по запуску проекта (FastAPI + React + Postgres)

## 1. Требования

* Docker и Docker Compose
* Git (если проект клонируется)

```bash
docker -v
docker compose version
git --version
```

## 2. Клонирование репозитория

```bash
git clone https://github.com/dlemesonok0/opp.git
cd opp
```

## 4. Настройка `.env`

```env
POSTGRES_USER=appuser
POSTGRES_PASSWORD=apppass
POSTGRES_DB=appdb
DATABASE_URL=postgresql+psycopg://appuser:apppass@db:5432/appdb
VITE_API_URL=http://localhost:8080
```

## 6. Запуск проекта

сбилдить проект
```bash
docker compose up --build
```
когда контейнер уже создан
```bash
docker compose up
```
без логов (в фоне)
```bash
docker compose up -d
```
Открой:

* Frontend → [http://localhost:3000](http://localhost:3000)
* Backend API → [http://localhost:8080/ping](http://localhost:8080/ping)

## 7. Горячая перезагрузка

* Фронт — автоматически перезапускается Vite.
* Бэк — `uvicorn --reload` обновляется при изменении.

## 9. Остановка контейнеров

```bash
docker compose down
```

Добавь `-v` чтобы удалить volume с базой данных.

✅ После выполнения `docker compose up --build` пользователь получает полностью рабочее окружение с FastAPI, React и Postgres, готовое к разработке.
