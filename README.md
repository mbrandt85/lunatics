# 🌌 Lunatics Monorepo

> **God Tier DDD Endpoint - Level 3 (Global System Standard)**

Welcome to the **Lunatics** ecosystem. This monorepo houses a high-scale, AI-driven data pipeline and intelligence platform designed to correlate celestial events (moon phases) with real-world activity (crime statistics) to generate actionable insights and news.

---

## 🏗 System Architecture

The Lunatics platform follows a modern, serverless, and data-centric architecture:

- **Frontend:** Angular 21 Single Page Application (SPA) providing visualization and reporting.
- **Backend:** Firebase Gen 2 Cloud Functions executing scheduled AI ingestion and processing.
- **Data Warehouse:** Google BigQuery acting as the primary analytical engine.
- **Transformation:** dbt (Data Build Tool) for modular, version-controlled SQL transformations.
- **Intelligence:** Google Gemini AI (Flash 1.5) for data analysis and natural language generation.

---

## 📂 Workspace Topology

This project is managed as a `pnpm` workspace, ensuring ecosystem consistency and efficient dependency management.

| Package | Context | Responsibility |
| :--- | :--- | :--- |
| [`web`](./web) | Frontend | User interface, charts, and real-time dashboard. |
| [`functions`](./functions) | Serverless | Scheduled jobs, Gemini AI integration, BQ ingestion. |
| [`langgraph`](./langgraph) | Agents | Multi-stage AI reasoning flow for article generation. |
| [`shared`](./shared) | Core Logic | Shared TypeScript models, schemas, and ubiquitous language. |
| [`dbt`](./dbt) | Data Engineering | BigQuery SQL models (Staging, Intermediate, Marts). |
| [`scratch`](./scratch) | Tooling | Local scripts for manual triggering and experimentation. |

---

## 🛠 Tech Stack

- **Runtime:** Node.js 22 (LTS)
- **Frameworks:** Angular 21, Firebase Functions v2, LangGraph (Python)
- **Data:** BigQuery, Firestore
- **AI:** Gemini 1.5 Flash, LangGraph
- **Ops:** GitHub Actions, Docker, Cloud Run Jobs / Services
- **Styling:** Vanilla CSS, Angular Material

---

## 🚀 Getting Started

### Prerequisites
- `pnpm` (latest)
- `firebase-tools`
- `gcloud` CLI (configured for project `lunatics-d8b5a`)

### Installation
```bash
pnpm install
```

### Local Development
Run the Firebase emulators to test functions and firestore locally:
```bash
pnpm run dev:emulators
```

---

## 🛰 CI/CD & Deployment

Automated pipelines are defined in [`.github/workflows`](./.github/workflows):

1.  **Functions:** `deploy-functions.yml` - Builds shared library, prepares `shared-local`, and deploys to Firebase.
2.  **Web:** `deploy-web.yml` - Builds Angular and deploys to Firebase Hosting.
3.  **dbt:** `deploy-dbt.yml` - Containerizes dbt with Docker and deploys to Cloud Run Jobs.
4.  **LangGraph:** `deploy-langgraph.yml` - Containerizes the Python agent and deploys to Cloud Run Services.

---

## 📜 Operational Rules

- **Discrete Interaction:** All documentation and code comments MUST be in English.
- **Dependency Respect:** Always inspect `package.json` in the respective workspace before adding new libraries.
- **Refactor-First:** If code deviates from the local `README.md` or DDD Bounded Context, flag it immediately.

---

**Antigravity Architect** - *High technical density, zero noise.*
