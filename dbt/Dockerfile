FROM python:3.11-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

RUN pip install --no-cache-dir dbt-bigquery==1.8.0

COPY . .

ENTRYPOINT ["dbt"]
