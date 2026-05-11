# 📊 Lunatics dbt

> **Bounded Context: Data Transformation & Analytics Engineering**

The `dbt` workspace contains the **Data Build Tool** project for the Lunatics platform. It manages the transformation layer in **Google BigQuery**, turning raw ingestion data into curated analytical marts.

---

## 🎯 Context & Analytics Pipeline

This project implements the "T" in our ELT pipeline. It takes raw data ingested by Firebase Functions and structures it for visualization in the `web` application.

### Layered Modeling:
1.  **Staging (`staging`):** Clean, cast, and rename raw data from `lunatics_raw.raw_crimes`.
2.  **Intermediate (`intermediate`):** Complex joins and temporal calculations (e.g., matching crimes to moon phases).
3.  **Marts (`marts`):** Final, high-performance tables like `fct_daily_stats` used by the `web` frontend and `articlePublisher`.

---

## 🏗 Domain Model

- **`lunatics_dbt`**: The primary dbt project namespace.
- **Profile:** `lunatics` (Configured to connect to BigQuery project `lunatics-d8b5a`).

---

## 🛠 Tech Stack

- **Tool:** dbt-core
- **Adapter:** `dbt-bigquery`
- **Warehouse:** Google BigQuery
- **Deployment:** Dockerized runtime on Google Cloud Run Jobs.

---

## 🚀 Execution & Deployment

### Local Development
1.  Ensure you have `dbt-bigquery` installed.
2.  Configure your `profiles.yml` with the `lunatics` profile.
3.  Run transformations:
    ```bash
    dbt run
    ```
4.  Run tests:
    ```bash
    dbt test
    ```

### Production Deployment
The dbt project is deployed as a **Cloud Run Job** via GitHub Actions (`deploy-dbt.yml`). 
- **Image:** `europe-west1-docker.pkg.dev/lunatics-d8b5a/lunatics-repo/dbt:latest`
- **Region:** `europe-west1`

---

## 📜 Operational Rules

- **Testing:** Every model MUST have a schema test (at least `unique` and `not_null` on primary keys).
- **Documentation:** All models and columns should be documented in `.yml` files.
- **Materialization:** Marts are materialized as `table`, while staging is typically `view`.

---

**Antigravity Architect** - *Data integrity, analytical precision.*
