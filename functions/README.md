# ⚡ Lunatics Functions

> **Bounded Context: Data Ingestion & AI Processing Pipeline**

The `functions` workspace contains the serverless logic for the Lunatics platform, built on **Firebase Gen 2 (v2)** and **Node.js 22**.

---

## 🎯 Context & Data Pipeline

This workspace is the engine room of the ecosystem. It executes high-density data operations and AI reasoning.

### Data Flow Overview:
1.  **Ingestion:** `fetchAndAnalyze` (Scheduled hourly/3-hourly) fetches raw events from the Polisen API.
2.  **AI Analysis:** Events are filtered and sent to **Gemini 1.5 Flash** to extract and categorize violent crimes.
3.  **Storage:** Analyzed data is streamed to **BigQuery** (`raw_crimes`) and cached in **Firestore** (`processed_events`).
4.  **Transformation:** Downstream dbt models transform raw data into analytical stats.
5.  **Publishing:** `articlePublisher` (Scheduled daily at 01:00) reads BigQuery stats and moon phases, prompts Gemini to write a news report, and saves it to Firestore.

---

## 🏗 Domain Model (Functions)

- **`fetchAndAnalyze`**: Handles idempotent fetching and AI-assisted categorization of raw data.
- **`articlePublisher`**: Orchestrates the natural language generation of daily reports.

---

## 🛠 Tech Stack & Dependencies

- **Runtime:** Node.js 22
- **Firebase Functions:** v2 (Gen 2)
- **AI Integration:** `@google/genai` (Google Gemini 1.5 Flash)
- **Data Warehousing:** `@google-cloud/bigquery`
- **Database:** `firebase-admin` (Firestore)
- **Shared Logic:** `@lunatics/shared` (Via `shared-local` workaround)

---

## 🚀 Execution & Deployment

### Important: Shared Library Workaround
Due to Firebase's deployment constraints regarding monorepos, this workspace utilizes a `shared-local` pattern. During deployment, the CI/CD pipeline (and `predeploy` script) copies the `@lunatics/shared` code into a local folder:
```bash
rm -rf functions/shared-local && cp -r shared functions/shared-local
```

### IAM Requirements
The deployment service account MUST have the following roles for scheduled functions to work:
- **Cloud Scheduler Admin**
- **Service Account User**

### Deployment
```bash
pnpm run deploy
```

---

## 📜 Operational Runbook

- **Monitoring:** Use `firebase functions:log` or the GCP Logging console.
- **Secrets:** All AI processing requires the `GEMINI_API_KEY` secret to be set in Firebase.
- **Timezones:** Scheduling logic is locked to `Europe/Stockholm` to ensure consistency with Swedish law enforcement reporting cycles.

---

**Antigravity Architect** - *Computational density, serverless excellence.*
