FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py index.html ./
COPY data/ data/
COPY static/ static/

EXPOSE 8080

CMD gunicorn --bind 0.0.0.0:8080 --workers 2 --threads 4 --timeout 60 app:app
