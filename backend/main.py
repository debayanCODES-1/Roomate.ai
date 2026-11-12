import argparse
import os
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from backend.agents.orchestrator import LifestyleProfile, lifestyle_embedding, orchestrator
from backend.models import Base, Match, Swipe, User
from backend.services.kyc import get_kyc_provider, hash_reference_id


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://roommate:roommate_dev@localhost:5432/roommate",
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

app = FastAPI(title="Roommate Finder API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_origin_regex=r"https://[a-zA-Z0-9-]+-3000\.app\.github\.dev",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["*"],
)


class OnboardRequest(BaseModel):
    user_id: uuid.UUID
    message: str = Field(min_length=1, max_length=4000)


class KycRequest(BaseModel):
    user_id: uuid.UUID
    authorization_code: str | None = None
    sandbox_gender: str | None = None
    sandbox_age: int | None = Field(default=None, ge=18, le=100)


class SwipeRequest(BaseModel):
    swiper_id: uuid.UUID
    candidate_id: uuid.UUID
    liked: bool


class PreferencesRequest(BaseModel):
    allow_coed_living: bool
    min_rent_budget: int = Field(ge=0, le=10_000_000)
    max_rent_budget: int = Field(gt=0, le=10_000_000)
    deposit_budget: int = Field(ge=0, le=100_000_000)
    utilities_share: bool
    commute_location: str = Field(default="", max_length=200)
    commute_lat: float | None = Field(default=None, ge=-90, le=90)
    commute_lng: float | None = Field(default=None, ge=-180, le=180)
    max_commute_km: int = Field(default=15, ge=1, le=500)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def initialize_database():
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)


def _user_record(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "name": user.name,
        "occupation": user.occupation,
        "is_kyc_verified": user.is_kyc_verified,
        "verified_gender": user.verified_gender,
        "verified_age": user.verified_age,
        "allow_coed_living": user.allow_coed_living,
        "min_rent_budget": user.min_rent_budget,
        "max_rent_budget": user.max_rent_budget,
        "deposit_budget": user.deposit_budget,
        "utilities_share": user.utilities_share,
        "commute_location": user.commute_location,
        "commute_lat": user.commute_lat,
        "commute_lng": user.commute_lng,
        "max_commute_km": user.max_commute_km,
        "profile": user.profile or {},
        "lifestyle_embedding": user.lifestyle_embedding,
    }


def _get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User was not found.")
    return user


def _evaluate_pair(user: User, candidate: User) -> dict[str, Any]:
    state = orchestrator.invoke({
        "task": "match",
        "user": _user_record(user),
        "candidate": _user_record(candidate),
    })
    return state


def _candidate_card(user: User, candidate: User, report: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(candidate.id),
        "name": candidate.name,
        "age": candidate.verified_age,
        "occupation": candidate.occupation,
        "is_kyc_verified": candidate.is_kyc_verified,
        "profile": candidate.profile or {},
        "max_rent_budget": candidate.max_rent_budget,
        "commute_location": candidate.commute_location,
        "match_percentage": report["match_percentage"],
        "green_flags": report["green_flags"],
        "potential_friction": report["potential_friction"],
        "icebreakers": report["icebreakers"],
    }


@app.get("/api/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok"}


@app.get("/api/demo/users")
def demo_users(db: Session = Depends(get_db)):
    users = db.scalars(select(User).where(User.is_kyc_verified.is_(True)).order_by(User.name)).all()
    return [
        {
            "id": str(user.id),
            "name": user.name,
            "gender": user.verified_gender,
            "allow_coed_living": user.allow_coed_living,
        }
        for user in users
    ]


@app.post("/api/onboard/chat")
def onboard_chat(request: OnboardRequest, db: Session = Depends(get_db)):
    user = _get_user(db, request.user_id)
    state = orchestrator.invoke({
        "task": "onboard",
        "profile": user.profile or {},
        "message": request.message,
    })
    profile = LifestyleProfile.model_validate(state["profile"]).model_dump()
    user.profile = profile
    user.lifestyle_embedding = lifestyle_embedding(profile)
    db.commit()
    return {"profile": profile, "assistant_reply": state["assistant_reply"]}


@app.post("/api/kyc/verify")
async def verify_kyc(request: KycRequest, db: Session = Depends(get_db)):
    user = _get_user(db, request.user_id)
    provider = get_kyc_provider()
    try:
        verified = await provider.verify(
            request.authorization_code,
            mock_gender=request.sandbox_gender,
            mock_age=request.sandbox_age,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    reference_hash = hash_reference_id(verified.reference_id)
    user.is_kyc_verified = True
    user.verified_gender = verified.gender
    user.verified_age = verified.age
    user.kyc_reference_hash = reference_hash
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This verification reference is already linked to an account.") from exc
    return {
        "is_kyc_verified": user.is_kyc_verified,
        "verified_gender": user.verified_gender,
        "verified_age": user.verified_age,
    }


@app.put("/api/preferences/{user_id}")
def update_preferences(
    user_id: uuid.UUID,
    request: PreferencesRequest,
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    if request.min_rent_budget > request.max_rent_budget:
        raise HTTPException(status_code=422, detail="Minimum rent budget cannot exceed maximum rent budget.")
    for field, value in request.model_dump().items():
        setattr(user, field, value)
    db.commit()
    return {"allow_coed_living": user.allow_coed_living, "max_rent_budget": user.max_rent_budget}


@app.get("/api/feed/{user_id}")
def get_feed(user_id: uuid.UUID, db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    if not user.is_kyc_verified:
        raise HTTPException(status_code=403, detail="Complete identity verification before viewing roommate matches.")
    candidates = db.scalars(
        select(User).where(User.id != user.id, User.is_kyc_verified.is_(True))
    ).all()
    cards = []
    for candidate in candidates:
        existing_swipe = db.scalar(
            select(Swipe).where(Swipe.swiper_id == user.id, Swipe.candidate_id == candidate.id)
        )
        if existing_swipe:
            continue
        state = _evaluate_pair(user, candidate)
        if state.get("eligible") and state.get("report"):
            cards.append(_candidate_card(user, candidate, state["report"]))
    cards.sort(key=lambda card: card["match_percentage"], reverse=True)
    return {"user_id": str(user.id), "cards": cards}


@app.post("/api/swipe")
def record_swipe(request: SwipeRequest, db: Session = Depends(get_db)):
    if request.swiper_id == request.candidate_id:
        raise HTTPException(status_code=422, detail="A user cannot swipe on their own profile.")
    user = _get_user(db, request.swiper_id)
    candidate = _get_user(db, request.candidate_id)
    state = _evaluate_pair(user, candidate)
    if not state.get("eligible"):
        raise HTTPException(status_code=403, detail=state.get("rejection_reason", "This profile pair is not eligible."))
    swipe = db.scalar(
        select(Swipe).where(Swipe.swiper_id == user.id, Swipe.candidate_id == candidate.id)
    )
    if swipe:
        swipe.liked = request.liked
    else:
        db.add(Swipe(swiper_id=user.id, candidate_id=candidate.id, liked=request.liked))
    db.flush()

    match_room_id = None
    report = state.get("report", {})
    if request.liked:
        reciprocal = db.scalar(
            select(Swipe).where(
                Swipe.swiper_id == candidate.id,
                Swipe.candidate_id == user.id,
                Swipe.liked.is_(True),
            )
        )
        if reciprocal:
            low_id, high_id = sorted((user.id, candidate.id), key=lambda value: value.int)
            match = db.scalar(
                select(Match).where(Match.user_low_id == low_id, Match.user_high_id == high_id)
            )
            if not match:
                match = Match(
                    user_low_id=low_id,
                    user_high_id=high_id,
                    compatibility_report=report,
                )
                db.add(match)
            match_room_id = str(match.id)
    db.commit()
    return {
        "is_mutual_match": match_room_id is not None,
        "chat_room_id": match_room_id,
        "match": {
            "user": {"id": str(candidate.id), "name": candidate.name},
            "compatibility_report": report,
        } if match_room_id else None,
    }


@app.get("/api/matches/{user_id}")
def get_matches(user_id: uuid.UUID, db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    matches = db.scalars(
        select(Match).where((Match.user_low_id == user.id) | (Match.user_high_id == user.id))
    ).all()
    result = []
    for match in matches:
        other_id = match.user_high_id if match.user_low_id == user.id else match.user_low_id
        other = _get_user(db, other_id)
        result.append({
            "chat_room_id": str(match.id),
            "user": {"id": str(other.id), "name": other.name, "age": other.verified_age, "occupation": other.occupation},
            "compatibility_report": match.compatibility_report,
        })
    return {"matches": result}


def seed_demo_data():
    with engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)
    demo_profiles = [
        {
            "name": "Aarav", "occupation": "Product designer · Bengaluru", "gender": "man", "age": 27,
            "max_rent_budget": 18000, "min_rent_budget": 12000, "deposit_budget": 40000,
            "commute_location": "Koramangala, Bengaluru", "lat": 12.9352, "lng": 77.6245,
            "profile": {"wake_time": "07:30", "sleep_time": "23:30", "sleeper_type": "average", "cleaning_frequency": "weekends", "dishwashing_tolerance": "same_day", "work_mode": "hybrid", "work_hours": "10:00-18:00", "guests": "Friends with notice", "parties": "Occasional with notice", "smoking": "no", "drinking": "occasionally", "food": "veg"},
        },
        {
            "name": "Mira", "occupation": "Architecture student · Bengaluru", "gender": "woman", "age": 24,
            "max_rent_budget": 16000, "min_rent_budget": 11000, "deposit_budget": 35000,
            "commute_location": "Indiranagar, Bengaluru", "lat": 12.9784, "lng": 77.6408,
            "profile": {"wake_time": "08:00", "sleep_time": "00:30", "sleeper_type": "light", "cleaning_frequency": "weekends", "dishwashing_tolerance": "same_day", "work_mode": "student", "work_hours": "Studio classes, daytime", "guests": "Ask first", "parties": "Rare", "smoking": "no", "drinking": "no", "food": "eggetarian"},
        },
        {
            "name": "Ishita", "occupation": "Software engineer · Bengaluru", "gender": "woman", "age": 26,
            "max_rent_budget": 17000, "min_rent_budget": 13000, "deposit_budget": 45000,
            "commute_location": "Koramangala, Bengaluru", "lat": 12.9348, "lng": 77.6150,
            "profile": {"wake_time": "08:30", "sleep_time": "01:00", "sleeper_type": "heavy", "cleaning_frequency": "daily", "dishwashing_tolerance": "immediate", "work_mode": "wfh", "work_hours": "09:30-18:30", "guests": "Friends on weekends", "parties": "Occasional", "smoking": "no", "drinking": "occasionally", "food": "non_veg"},
        },
        {
            "name": "Dev", "occupation": "Research scholar · Bengaluru", "gender": "man", "age": 29,
            "max_rent_budget": 15000, "min_rent_budget": 10000, "deposit_budget": 30000,
            "commute_location": "Jayanagar, Bengaluru", "lat": 12.9250, "lng": 77.5838,
            "profile": {"wake_time": "06:30", "sleep_time": "22:30", "sleeper_type": "light", "cleaning_frequency": "weekly", "dishwashing_tolerance": "next_day", "work_mode": "student", "work_hours": "Research, flexible", "guests": "Rarely", "parties": "No parties", "smoking": "no", "drinking": "no", "food": "veg"},
        },
    ]
    with SessionLocal() as db:
        for index, data in enumerate(demo_profiles):
            user_id = uuid.uuid5(uuid.NAMESPACE_URL, f"roommate-demo-user-{data['name'].lower()}")
            user = db.get(User, user_id)
            if not user:
                user = User(id=user_id, name=data["name"])
                db.add(user)
            user.name = data["name"]
            user.occupation = data["occupation"]
            user.is_kyc_verified = True
            user.verified_gender = data["gender"]
            user.verified_age = data["age"]
            user.kyc_reference_hash = hash_reference_id(f"demo-verified-reference-{index}")
            user.allow_coed_living = False
            user.min_rent_budget = data["min_rent_budget"]
            user.max_rent_budget = data["max_rent_budget"]
            user.deposit_budget = data["deposit_budget"]
            user.utilities_share = True
            user.commute_location = data["commute_location"]
            user.commute_lat = data["lat"]
            user.commute_lng = data["lng"]
            user.max_commute_km = 15
            user.profile = data["profile"]
            user.lifestyle_embedding = lifestyle_embedding(user.profile)
        db.commit()
    print("Seeded 4 verified demo users. Their IDs are available at GET /api/demo/users.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", action="store_true", help="Create database tables and seed verified demo profiles.")
    args = parser.parse_args()
    if args.seed:
        seed_demo_data()
    else:
        import uvicorn

        uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
