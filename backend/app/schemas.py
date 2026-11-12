"""Pydantic models for the analysis report and chat API.

The same structure is sent to the model as a strict JSON schema, then every
response is validated again here before it reaches the browser.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MaterialCategory = Literal[
    "plastic", "paper", "cardboard", "glass", "metal", "organic", "e_waste",
    "textile", "wood", "ceramic", "rubber", "hazardous", "composite", "unknown",
]
Confidence = Literal["high", "medium", "low"]
HarmLevel = Literal["low", "moderate", "high", "hazardous", "unknown"]
TriState = Literal["yes", "no", "conditional", "unknown"]


MAX_TEXT = 1500   # characters per text field
MAX_ITEMS = 10    # entries per list


class _Strict(BaseModel):
    """Lenient on length: over-long model output is trimmed rather than rejected,
    so one verbose sentence never throws away an otherwise valid analysis."""

    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    @field_validator("*", mode="before")
    @classmethod
    def _trim(cls, v):
        if isinstance(v, str):
            return v[:MAX_TEXT]
        if isinstance(v, list):
            items = [x[:MAX_TEXT] if isinstance(x, str) else x for x in v[:MAX_ITEMS]]
            return [x for x in items if x not in ("", None)]
        return v


class Material(_Strict):
    name: str = Field(..., description="اسم المادة بالعربية")
    name_en: str = Field("", description="Technical English name, e.g. PET (#1)")
    category: MaterialCategory
    share: str = Field("", description="Approximate role in the item, e.g. الجسم الرئيسي")


class Classification(_Strict):
    recyclable: TriState
    reusable: TriState
    biodegradable: TriState
    hazardous: TriState
    eco_friendly: TriState


class Decomposition(_Strict):
    known: bool
    estimate: str = Field("")
    note: str = Field("")


class Recycling(_Strict):
    status: TriState
    explanation: str = Field(...)
    local_availability_jordan: str = Field(...)
    preparation_steps: list[str] = Field(default_factory=list)


class Alternative(_Strict):
    title: str = Field(...)
    why: str = Field(...)


class AnalysisReport(_Strict):
    is_analyzable: bool
    unclear_reason: str = Field("")
    item_name: str = Field(...)
    item_name_en: str = Field("")
    summary: str = Field(...)
    confidence: Confidence
    confidence_note: str = Field("")
    materials: list[Material] = Field(default_factory=list)
    classification: Classification
    harm_level: HarmLevel
    harm_score: int  # clamped to 0–100 below
    environmental_impact: str = Field(...)
    pollution_risks: list[str] = Field(default_factory=list)
    decomposition: Decomposition
    recycling: Recycling
    disposal_steps: list[str] = Field(default_factory=list)
    safety_warnings: list[str] = Field(default_factory=list)
    requires_special_handling: bool
    reuse_ideas: list[str] = Field(default_factory=list)
    alternatives: list[Alternative] = Field(default_factory=list)
    reduce_tips: list[str] = Field(default_factory=list)
    extra_tips: list[str] = Field(default_factory=list)

    @field_validator("harm_score")
    @classmethod
    def _clamp(cls, v: int) -> int:
        return max(0, min(100, v))


class AnalysisResponse(BaseModel):
    id: str
    report: AnalysisReport
    model: str
    demo: bool = False


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=30)
    context: AnalysisReport | None = None


class ChatResponse(BaseModel):
    reply: str
    demo: bool = False


class ErrorResponse(BaseModel):
    error: str
    code: str


# ---------------------------------------------------------------------------
# JSON schema handed to the model (OpenAI structured outputs, strict mode).
# Strict mode requires every property to be listed in "required" and
# additionalProperties: false on every object.
# ---------------------------------------------------------------------------

def _obj(props: dict) -> dict:
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


_S = {"type": "string"}
_LIST_S = {"type": "array", "items": _S}
_TRI = {"type": "string", "enum": ["yes", "no", "conditional", "unknown"]}

ANALYSIS_JSON_SCHEMA: dict = _obj({
    "is_analyzable": {"type": "boolean"},
    "unclear_reason": _S,
    "item_name": _S,
    "item_name_en": _S,
    "summary": _S,
    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
    "confidence_note": _S,
    "materials": {"type": "array", "items": _obj({
        "name": _S,
        "name_en": _S,
        "category": {"type": "string", "enum": list(MaterialCategory.__args__)},
        "share": _S,
    })},
    "classification": _obj({
        "recyclable": _TRI, "reusable": _TRI, "biodegradable": _TRI,
        "hazardous": _TRI, "eco_friendly": _TRI,
    }),
    "harm_level": {"type": "string", "enum": ["low", "moderate", "high", "hazardous", "unknown"]},
    "harm_score": {"type": "integer"},
    "environmental_impact": _S,
    "pollution_risks": _LIST_S,
    "decomposition": _obj({"known": {"type": "boolean"}, "estimate": _S, "note": _S}),
    "recycling": _obj({
        "status": _TRI,
        "explanation": _S,
        "local_availability_jordan": _S,
        "preparation_steps": _LIST_S,
    }),
    "disposal_steps": _LIST_S,
    "safety_warnings": _LIST_S,
    "requires_special_handling": {"type": "boolean"},
    "reuse_ideas": _LIST_S,
    "alternatives": {"type": "array", "items": _obj({"title": _S, "why": _S})},
    "reduce_tips": _LIST_S,
    "extra_tips": _LIST_S,
})
