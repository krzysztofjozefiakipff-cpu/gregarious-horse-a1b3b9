FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libcairo2 libgomp1 libglib2.0-0 libgl1 && rm -rf /var/lib/apt/lists/*
COPY tools/carvelo-photo-ai/requirements-gh.txt /app/requirements-gh.txt
COPY tools/carvelo-photo-ai/requirements-interior.txt /app/requirements-interior.txt
RUN python -m pip install --no-cache-dir torch==2.7.1 --index-url https://download.pytorch.org/whl/cpu
RUN python -m pip install --no-cache-dir -r /app/requirements-gh.txt -r /app/requirements-interior.txt "psycopg[binary]==3.2.12"
COPY tools/carvelo-photo-ai/ /app/tools/carvelo-photo-ai/
COPY assets/brand/ /app/assets/brand/
RUN useradd --create-home worker && chown -R worker:worker /app
USER worker
CMD ["python","tools/carvelo-photo-ai/persistent_worker.py"]
