FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

WORKDIR /workspace

COPY requirements.txt .
RUN pip install -r requirements.txt

EXPOSE 8000
EXPOSE 5002

CMD ["python", "run.py"]