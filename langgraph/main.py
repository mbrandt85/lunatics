import os
from typing import TypedDict, List, Optional
from fastapi import FastAPI, Body
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel

# 1. Define Agent State
class AgentState(TypedDict):
    stats: dict
    events: List[dict]
    title: Optional[str]
    draft: Optional[str]
    critique: Optional[str]
    approved: bool
    final_article: Optional[dict]

# 2. Define Nodes
def brainstorm_node(state: AgentState):
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
    prompt = f"Brainstorm a moon-related title and angle. Stats: {state['stats']}. Events: {state['events']}"
    res = llm.invoke(prompt)
    return {"title": res.content}

def draft_node(state: AgentState):
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
    prompt = f"Write a draft for '{state['title']}'. Stats: {state['stats']}"
    res = llm.invoke(prompt)
    return {"draft": res.content}

def critique_node(state: AgentState):
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
    prompt = f"Critique this draft: {state['draft']}. Is it 'God Tier'?"
    res = llm.invoke(prompt)
    return {"critique": res.content}

def finalize_node(state: AgentState):
    # This only runs if approved is True
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
    prompt = f"Finalize this article into JSON based on critique: {state['critique']}. Draft: {state['draft']}"
    # In a real scenario, we'd use structured output here
    res = llm.invoke(prompt)
    # Mocking JSON response for brevity
    return {"final_article": {"title": state['title'], "body": res.content}}

# 3. Build Graph with HIT (Human-In-The-Loop)
workflow = StateGraph(AgentState)

workflow.add_node("brainstorm", brainstorm_node)
workflow.add_node("draft", draft_node)
workflow.add_node("critique", critique_node)
workflow.add_node("finalize", finalize_node)

workflow.set_entry_point("brainstorm")
workflow.add_edge("brainstorm", "draft")
workflow.add_edge("draft", "critique")

# We interrupt BEFORE finalize to allow human review
workflow.add_edge("critique", "finalize")
workflow.add_edge("finalize", END)

# Checkpointer for HIT
memory = MemorySaver()
app_graph = workflow.compile(checkpointer=memory, interrupt_before=["finalize"])

# 4. FastAPI Setup
app = FastAPI(title="Lunatics LangGraph Agent (Python)")

class GenerateRequest(BaseModel):
    thread_id: str
    stats: dict
    events: List[dict]

@app.post("/start")
async def start_generation(req: GenerateRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    initial_state = {
        "stats": req.stats,
        "events": req.events,
        "approved": False,
        "revision_count": 0
    }
    
    # Run until the interrupt point
    result = app_graph.invoke(initial_state, config)
    
    # Check if we are at an interrupt
    state = app_graph.get_state(config)
    return {
        "status": "waiting_for_approval",
        "next_step": state.next,
        "current_state": {
            "title": state.values.get("title"),
            "draft": state.values.get("draft"),
            "critique": state.values.get("critique")
        }
    }

@app.post("/approve/{thread_id}")
async def approve_generation(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    
    # Resume the graph by passing None as input (it picks up where it left off)
    app_graph.invoke(None, config)
    
    state = app_graph.get_state(config)
    return {
        "status": "completed",
        "final_article": state.values.get("final_article")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
