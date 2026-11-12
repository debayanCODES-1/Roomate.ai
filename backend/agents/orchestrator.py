import math
import os
import re
from typing import Any, Literal, TypedDict

from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field


class LifestyleProfile(BaseModel):
    wake_time: str = "08:00"
    sleep_time: str = "23:00"
    sleeper_type: Literal["light", "heavy", "average"] = "average"
    cleaning_frequency: Literal["daily", "weekends", "weekly", "flexible"] = "flexible"
    dishwashing_tolerance: Literal["immediate", "same_day", "next_day", "low"] = "same_day"
    work_mode: Literal["wfh", "hybrid", "office", "night_shift", "student", "other"] = "other"
    work_hours: str = ""
    guests: str = "Discuss in advance"
    parties: str = "Occasional with notice"
    smoking: Literal["no", "outside_only", "yes"] = "no"
    drinking: Literal["no", "occasionally", "yes"] = "occasionally"
    food: Literal["veg", "non_veg", "eggetarian", "no_preference"] = "no_preference"


class OnboardingExtraction(BaseModel):
    profile: LifestyleProfile
    assistant_reply: str = Field(description="Warm, brief follow-up asking for any important missing details.")


class CompatibilityReport(BaseModel):
    match_percentage: int = Field(ge=0, le=100)
    green_flags: list[str] = Field(min_length=3, max_length=3)
    potential_friction: list[str] = Field(min_length=1, max_length=2)
    icebreakers: list[str] = Field(min_length=2, max_length=3)


class AgentState(TypedDict, total=False):
    task: str
    user: dict[str, Any]
    candidate: dict[str, Any]
    message: str
    profile: dict[str, Any]
    assistant_reply: str
    eligible: bool
    rejection_reason: str
    rent_budget_compatibility: int
    financial_compatibility: int
    deposit_compatibility: int
    utility_compatibility: int
    commute_compatibility: int
    vector_similarity: float
    report: dict[str, Any]


def _client():
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        temperature=0.2,
        google_api_key=api_key,
    )


def lifestyle_embedding(profile: dict[str, Any]) -> list[float]:
    """Create a stable local 64-dimension lifestyle vector without sending profile data externally."""
    values = [0.0] * 64
    text = " ".join(f"{key}:{value}" for key, value in sorted(profile.items())).lower()
    tokens = re.findall(r"[a-z0-9_]+", text)
    for token in tokens:
        index = sum((position + 1) * ord(char) for position, char in enumerate(token)) % len(values)
        values[index] += 1.0 if len(token) % 2 else -1.0
    norm = math.sqrt(sum(value * value for value in values))
    return [value / norm for value in values] if norm else values


def _cosine(left: list[float] | None, right: list[float] | None) -> float:
    if left is None or right is None or not len(left) or len(left) != len(right):
        return 0.0
    return max(0.0, min(1.0, (sum(a * b for a, b in zip(left, right)) + 1.0) / 2.0))


def _pair_gender_allowed(user: dict[str, Any], candidate: dict[str, Any]) -> bool:
    if user.get("verified_gender") == candidate.get("verified_gender"):
        return True
    return bool(user.get("allow_coed_living") and candidate.get("allow_coed_living"))


def _distance_km(user: dict[str, Any], candidate: dict[str, Any]) -> float | None:
    coords = ("commute_lat", "commute_lng")
    if any(user.get(key) is None or candidate.get(key) is None for key in coords):
        return None
    lat1, lon1 = math.radians(user["commute_lat"]), math.radians(user["commute_lng"])
    lat2, lon2 = math.radians(candidate["commute_lat"]), math.radians(candidate["commute_lng"])
    delta_lat, delta_lon = lat2 - lat1, lon2 - lon1
    value = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    value = min(1.0, max(0.0, value))
    return 6371 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def onboarding_profiler(state: AgentState) -> AgentState:
    if state.get("task") != "onboard":
        return state
    existing = LifestyleProfile.model_validate(state.get("profile") or {}).model_dump()
    client = _client()
    if client:
        extraction = client.with_structured_output(OnboardingExtraction).invoke(
            [
                (
                    "system",
                    "You are a respectful roommate onboarding interviewer. Update the user's structured profile "
                    "using only facts from their message and existing profile. Do not infer sensitive traits. "
                    "Keep the assistant reply concise and ask a useful follow-up.",
                ),
                (
                    "human",
                    f"Existing profile: {existing}\nUser message: {state.get('message', '')}",
                ),
            ]
        )
        return {
            "profile": extraction.profile.model_dump(),
            "assistant_reply": extraction.assistant_reply,
        }

    message = state.get("message", "").lower()
    updated = dict(existing)
    patterns = {
        "sleep_time": r"(?:sleep|bed|turn in)\s*(?:at|around)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)",
        "wake_time": r"(?:wake|up)\s*(?:at|around)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)",
    }
    for field, pattern in patterns.items():
        match = re.search(pattern, message)
        if match:
            updated[field] = match.group(1).strip()
    choices = {
        "sleeper_type": {"light": ("light sleeper", "wake easily"), "heavy": ("heavy sleeper",)},
        "cleaning_frequency": {
            "daily": ("clean daily", "clean every day"),
            "weekends": ("weekend cleaner", "clean on weekends", "weekends"),
            "weekly": ("clean once a week", "clean weekly"),
        },
        "work_mode": {"wfh": ("work from home", "wfh"), "hybrid": ("hybrid",), "office": ("work in office", "office"), "night_shift": ("night shift",), "student": ("student", "college", "university")},
        "food": {
            "non_veg": ("non-vegetarian", "non vegetarian", "non-veg", "non veg"),
            "eggetarian": ("eggetarian",),
            "veg": ("vegetarian", "veg"),
        },
        "smoking": {"no": ("don't smoke", "do not smoke", "non-smoker"), "outside_only": ("smoke outside",), "yes": ("i smoke", "smoker")},
    }
    for field, options in choices.items():
        for value, phrases in options.items():
            if any(phrase in message for phrase in phrases):
                updated[field] = value
                break
    if any(phrase in message for phrase in ("wash dishes right away", "wash dishes immediately", "dishes immediately")):
        updated["dishwashing_tolerance"] = "immediate"
    elif any(phrase in message for phrase in ("dishes can wait until tomorrow", "dishes can wait till next day", "wash dishes tomorrow")):
        updated["dishwashing_tolerance"] = "next_day"
    elif any(phrase in message for phrase in ("wash dishes the same day", "dishes same day")):
        updated["dishwashing_tolerance"] = "same_day"
    elif any(phrase in message for phrase in ("hate washing dishes", "avoid washing dishes", "dishes pile up")):
        updated["dishwashing_tolerance"] = "low"
    if any(phrase in message for phrase in ("no guests", "no visitors")):
        updated["guests"] = "No guests"
    elif any(phrase in message for phrase in ("ask before guests", "ask before inviting", "check with me before")):
        updated["guests"] = "Ask first"
    elif any(phrase in message for phrase in ("friends can visit", "friends over", "friends can come over")):
        updated["guests"] = "Friends with notice"
    if any(phrase in message for phrase in ("no parties", "don't want parties", "do not want parties")):
        updated["parties"] = "No parties"
    elif "party" in message or "parties" in message:
        updated["parties"] = "Occasional with notice"
    if any(phrase in message for phrase in ("don't drink", "do not drink", "no alcohol")):
        updated["drinking"] = "no"
    elif any(phrase in message for phrase in ("drink occasionally", "social drinker", "occasionally drink")):
        updated["drinking"] = "occasionally"
    hours = re.search(r"\b(?:work|office|study|class(?:es)?)\s*(?:from\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)", message)
    if hours:
        updated["work_hours"] = f"{hours.group(1).strip()}-{hours.group(2).strip()}"
    return {
        "profile": updated,
        "assistant_reply": "Thanks, I’ve updated your roommate profile. What are your usual sleep hours, cleaning routine, or guest preferences?",
    }


def kyc_gender_guardrail(state: AgentState) -> AgentState:
    user, candidate = state["user"], state["candidate"]
    if not user.get("is_kyc_verified") or not candidate.get("is_kyc_verified"):
        return {"eligible": False, "rejection_reason": "Both profiles must complete identity verification."}
    if not _pair_gender_allowed(user, candidate):
        return {"eligible": False, "rejection_reason": "Verified gender preferences do not permit this match."}
    return {"eligible": True}


def pricing_commute_agent(state: AgentState) -> AgentState:
    user, candidate = state["user"], state["candidate"]
    user_budget, candidate_budget = user.get("max_rent_budget", 0), candidate.get("max_rent_budget", 0)
    budget_gap = abs(user_budget - candidate_budget) / max(user_budget, candidate_budget, 1)
    rent_compatibility = max(0, round(100 * (1 - budget_gap)))
    if budget_gap > 0.20:
        rent_compatibility = min(rent_compatibility, 35)
    user_deposit_capacity = min(
        100,
        round(100 * user.get("deposit_budget", 0) / max(user_budget, 1)),
    )
    candidate_deposit_capacity = min(
        100,
        round(100 * candidate.get("deposit_budget", 0) / max(candidate_budget, 1)),
    )
    deposit = min(user_deposit_capacity, candidate_deposit_capacity)
    utilities = 100 if user.get("utilities_share") == candidate.get("utilities_share") else 40
    financial = round(0.60 * rent_compatibility + 0.25 * deposit + 0.15 * utilities)
    distance = _distance_km(user, candidate)
    if distance is None:
        commute = 70 if user.get("commute_location") and candidate.get("commute_location") else 55
    else:
        allowed_distance = max(1, min(user.get("max_commute_km", 15), candidate.get("max_commute_km", 15)))
        commute = max(0, min(100, round(100 * (1 - distance / (allowed_distance * 2)))))
    return {
        "rent_budget_compatibility": rent_compatibility,
        "financial_compatibility": financial,
        "deposit_compatibility": deposit,
        "utility_compatibility": utilities,
        "commute_compatibility": commute,
    }


def _fallback_report(state: AgentState) -> dict[str, Any]:
    user, candidate = state["user"], state["candidate"]
    left, right = user.get("profile") or {}, candidate.get("profile") or {}
    vector = state.get("vector_similarity", 0.5)
    financial = state.get("financial_compatibility", 50)
    rent = state.get("rent_budget_compatibility", 50)
    deposit = state.get("deposit_compatibility", 50)
    utilities = state.get("utility_compatibility", 50)
    commute = state.get("commute_compatibility", 55)
    profile_keys = ("sleep_time", "wake_time", "sleeper_type", "cleaning_frequency", "work_mode", "food", "smoking", "drinking")
    values = [key for key in profile_keys if left.get(key) and right.get(key)]
    overlap = sum(left[key] == right[key] for key in values) / len(values) if values else 0.5
    score = round(0.40 * overlap * 100 + 0.25 * vector * 100 + 0.20 * financial + 0.15 * commute)
    flags = []
    if rent >= 80:
        flags.append("Your rent budgets are closely aligned.")
    if deposit >= 75:
        flags.append("You have compatible capacity for splitting the security deposit.")
    if utilities == 100:
        flags.append("You have the same preference about splitting utility costs.")
    if commute >= 75:
        flags.append("Your commute plans are a good fit.")
    if left.get("work_mode") == right.get("work_mode") and left.get("work_mode") not in {None, "other"}:
        flags.append(f"You share a {left.get('work_mode', 'similar')} work or study rhythm.")
    if left.get("cleaning_frequency") == right.get("cleaning_frequency") and left.get("cleaning_frequency") != "flexible":
        flags.append("You have similar expectations for keeping shared spaces clean.")
    if "Both profiles completed identity verification." not in flags:
        flags.append("Both profiles completed identity verification.")
    if len(flags) < 3:
        flags.append("You both have stated budgets and commute points to plan around.")
    if len(flags) < 3:
        flags.append("Your recorded lifestyle details give you a clear starting point for discussion.")
    friction = []
    if rent < 80:
        friction.append("Your rent budgets are more than 20% apart; agree on a target range before searching.")
    if deposit < 60:
        friction.append("Your upfront deposit budgets differ; agree on a fair split before committing.")
    if utilities < 100:
        friction.append("You have different expectations for sharing utility costs.")
    if left.get("sleep_time") != right.get("sleep_time"):
        friction.append(f"Different sleep schedules ({left.get('sleep_time', 'unspecified')} vs. {right.get('sleep_time', 'unspecified')}) may need quiet-hour agreements.")
    if left.get("cleaning_frequency") != right.get("cleaning_frequency"):
        friction.append("You may have different cleaning rhythms; agree on a chore schedule.")
    if not friction:
        friction.append("Clarify guest expectations and quiet hours before moving in.")
    return CompatibilityReport(
        match_percentage=max(0, min(100, score)),
        green_flags=flags[:3],
        potential_friction=friction[:2],
        icebreakers=[
            "What does your ideal low-key evening at home look like?",
            "How would you like to split chores and shared household essentials?",
        ],
    ).model_dump()


def deep_behavioral_matchmaker(state: AgentState) -> AgentState:
    user, candidate = state["user"], state["candidate"]
    user_embedding = user.get("lifestyle_embedding")
    if user_embedding is None:
        user_embedding = lifestyle_embedding(user.get("profile") or {})
    candidate_embedding = candidate.get("lifestyle_embedding")
    if candidate_embedding is None:
        candidate_embedding = lifestyle_embedding(candidate.get("profile") or {})
    similarity = _cosine(user_embedding, candidate_embedding)
    enriched = {**state, "vector_similarity": similarity}
    client = _client()
    if client:
        result = client.with_structured_output(CompatibilityReport).invoke(
            [
                (
                    "system",
                    "Compare two prospective roommates using only the supplied structured information. "
                    "Be candid and practical. Return exactly three specific green flags, one or two honest "
                    "frictions, and two friendly icebreakers. Score 0-100. Budget, commute, and lifestyle "
                    "vector similarity are inputs, not guarantees.",
                ),
                (
                    "human",
                    f"Person A profile/preferences: {user}\nPerson B profile/preferences: {candidate}\n"
                    f"Budget compatibility: {enriched.get('financial_compatibility')} / 100\n"
                    f"Deposit split compatibility: {enriched.get('deposit_compatibility')} / 100\n"
                    f"Utility sharing compatibility: {enriched.get('utility_compatibility')} / 100\n"
                    f"Commute compatibility: {enriched.get('commute_compatibility')} / 100\n"
                    f"Lifestyle vector similarity: {similarity:.3f}",
                ),
            ]
        )
        report = result.model_dump()
    else:
        report = _fallback_report(enriched)
    return {"vector_similarity": similarity, "report": report}


def _after_profiler(state: AgentState) -> str:
    return "finish" if state.get("task") == "onboard" else "guardrail"


def _after_guardrail(state: AgentState) -> str:
    return "pricing" if state.get("eligible") else "finish"


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("onboarding_profiler", onboarding_profiler)
    graph.add_node("kyc_gender_guardrail", kyc_gender_guardrail)
    graph.add_node("pricing_commute_agent", pricing_commute_agent)
    graph.add_node("deep_behavioral_matchmaker", deep_behavioral_matchmaker)
    graph.add_edge(START, "onboarding_profiler")
    graph.add_conditional_edges(
        "onboarding_profiler", _after_profiler,
        {"finish": END, "guardrail": "kyc_gender_guardrail"},
    )
    graph.add_conditional_edges(
        "kyc_gender_guardrail", _after_guardrail,
        {"finish": END, "pricing": "pricing_commute_agent"},
    )
    graph.add_edge("pricing_commute_agent", "deep_behavioral_matchmaker")
    graph.add_edge("deep_behavioral_matchmaker", END)
    return graph.compile()


orchestrator = build_graph()
