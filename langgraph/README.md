# 🦜 Lunatics LangGraph Agent (Python)

> **Bounded Context: Multi-Agent Article Reasoning & Human-In-The-Loop (HIT)**

The `langgraph` workspace implements an advanced multi-stage agentic workflow using **Python**, **LangGraph**, and **FastAPI**. It is designed for high-quality article generation with a manual approval step (HIT).

---

## 🎯 Context & Agentic Pipeline

This service serves as the core reasoning engine. Unlike a static script, this is a stateful graph that can be interrupted and resumed.

### Automated Deployment
The service is automatically deployed via GitHub Actions (`deploy-langgraph.yml`) on every push to the `main` branch that affects the `langgraph/` directory.

- **Service Name:** `lunatics-langgraph`
- **Region:** `europe-west1`
- **Platform:** Google Cloud Run (Service)

### Agent Workflow (StateGraph):
1.  **`brainstorm`**: Identifies the creative angle.
2.  **`draft`**: Generates the content.
3.  **`critique`**: Reviews for quality.
4.  **`INTERRUPT`**: The graph stops here. A human must review the `draft` and `critique` via the `/approve` endpoint.
5.  **`finalize`**: (Post-approval) Formats the article into validated JSON for Firestore.

---

## 🏗 Domain Model

- **AgentState**: A `TypedDict` managing the context (stats, events, title, draft, etc.).
- **MemorySaver**: Provides persistence across HTTP requests, allowing the graph to "wait" for human input.
- **FastAPI**: Exposes the graph via REST endpoints (`/start`, `/approve/{thread_id}`).

---

## 🛠 Tech Stack

- **Language:** Python 3.12
- **Framework:** LangGraph
- **LLM:** Google Gemini 1.5 Flash (`langchain-google-genai`)
- **API:** FastAPI + Uvicorn

---

## 🚀 Execution & Deployment

### Local Development
```bash
cd langgraph
pip install -r requirements.txt
export GEMINI_API_KEY=...
python main.py
```

### Human-In-The-Loop Flow
1.  **Start:** `POST /start` with data. Returns a `thread_id`.
2.  **Review:** Inspect the returned `draft` and `critique`.
3.  **Approve:** `POST /approve/{thread_id}` to let the agent finish the JSON formatting.

---

## 📜 Operational Rules

- **Thread IDs:** Always use unique thread IDs for each generation to avoid state collisions.
- **Python Consistency:** Keeps the logic aligned with the `dbt` workspace for easier data model sharing if needed.

---

**Antigravity Architect** - *Stateful intelligence, human-centric design.*
