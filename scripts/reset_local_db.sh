#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/../backend"
python - <<'PY'
import os

database_url = os.getenv("DATABASE_URL")
if not database_url:
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    dbname = os.getenv("POSTGRES_DB", "knowledge_brain")
    database_url = f"postgres://{user}:****@{host}:{port}/{dbname}"
print(f"Using database: {database_url}")
PY
python manage.py migrate
python manage.py flush --noinput
