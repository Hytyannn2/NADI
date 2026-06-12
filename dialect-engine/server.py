"""
NADI Dialect Engine — FastAPI Server
=====================================
HTTP microservice that exposes the dialect engine
for the Next.js frontend to consume.

Endpoints:
  POST /lookup        — Look up a dialect word
  POST /translate     — Translate a dialect phrase
  POST /feedback      — Submit a user correction
  GET  /prompt-context— Get dialect context for AI prompts
  GET  /clusters      — Get all dialect clusters
  GET  /stats         — Engine statistics
"""

import os
import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine import DialectEngine

# ===== App Setup =====
app = FastAPI(
    title="NADI Dialect Engine",
    description="Malay dialect normalization and crowdsourced training API",
    version="1.0.0",
)

# CORS — allow the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engine (singleton)
engine = DialectEngine()


# ===== Request/Response Models =====

class LookupRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)


class FeedbackRequest(BaseModel):
    dialect_text: str = Field(..., min_length=1, max_length=500,
                              description="What the user said in their dialect")
    correct_meaning: str = Field(..., min_length=1, max_length=500,
                                 description="The correct Standard Malay/English meaning")
    region: str = Field(default="unknown",
                        description="Dialect region: kelantan, terengganu, kedah, etc.")
    raw_voice: str = Field(default="",
                           description="The raw voice transcript before correction")


class PromptContextRequest(BaseModel):
    region: Optional[str] = None


# ===== Endpoints =====

@app.post("/lookup")
async def lookup_word(req: LookupRequest):
    """Look up a single dialect word and find its standard form."""
    result = engine.lookup(req.word)
    if result:
        return {"success": True, "result": result}
    return {
        "success": True,
        "result": None,
        "message": f"'{req.word}' not found in dialect database. "
                   "Submit feedback to help us learn!",
    }


@app.post("/translate")
async def translate_phrase(req: TranslateRequest):
    """Translate a dialect phrase to Standard Malay."""
    result = engine.translate_phrase(req.text)
    return {"success": True, "result": result}


@app.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    """
    Submit a user correction — this is how the engine learns!
    
    The user provides:
    - dialect_text: What they said in dialect
    - correct_meaning: The actual meaning in Standard Malay/English
    - region: Which dialect region
    - raw_voice: The raw browser SpeechRecognition transcript
    """
    result = engine.add_correction(
        dialect_text=req.dialect_text,
        correct_meaning=req.correct_meaning,
        region=req.region,
        raw_voice=req.raw_voice,
    )
    return {"success": True, "result": result}


@app.get("/prompt-context")
async def get_prompt_context(region: Optional[str] = None):
    """
    Get a compact dialect->standard mapping string
    for injecting into an AI prompt.
    """
    context = engine.export_for_prompt(region)
    return {
        "success": True,
        "context": context,
        "region": region or "all",
        "char_count": len(context),
    }


@app.get("/clusters")
async def get_clusters():
    """Get all dialect variant clusters."""
    clusters = engine.export_clusters_json()
    return {
        "success": True,
        "clusters": clusters,
        "count": len(clusters),
    }


@app.get("/stats")
async def get_stats():
    """Get engine statistics."""
    stats = engine.get_stats()
    return {"success": True, "stats": stats}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "engine": "NADI Dialect Engine v1.0.0"}


# ===== Main =====
if __name__ == '__main__':
    import uvicorn
    port = int(os.environ.get('DIALECT_ENGINE_PORT', 8100))
    print(f"\n[START] NADI Dialect Engine starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
