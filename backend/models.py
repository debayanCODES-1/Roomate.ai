import uuid
from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    occupation: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    is_kyc_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_gender: Mapped[str | None] = mapped_column(String(30))
    verified_age: Mapped[int | None] = mapped_column(Integer)
    kyc_reference_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    allow_coed_living: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_rent_budget: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_rent_budget: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    deposit_budget: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    utilities_share: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    commute_location: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    commute_lat: Mapped[float | None] = mapped_column(Float)
    commute_lng: Mapped[float | None] = mapped_column(Float)
    max_commute_km: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    profile: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    lifestyle_embedding: Mapped[list[float] | None] = mapped_column(Vector(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Swipe(Base):
    __tablename__ = "swipes"
    __table_args__ = (UniqueConstraint("swiper_id", "candidate_id", name="uq_swipe_pair"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    swiper_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    liked: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("user_low_id", "user_high_id", name="uq_match_pair"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_low_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_high_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    compatibility_report: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
