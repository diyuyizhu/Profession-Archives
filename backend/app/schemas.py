from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SkillCreate(BaseModel):
    name: str
    category: str | None = None
    tags: list[str] = Field(default_factory=list)


class ExperienceCreate(BaseModel):
    role: str
    company: str | None = None
    description_md: str
    tags: list[str] = Field(default_factory=list)
    start_date: str | None = None
    end_date: str | None = None


class EducationCreate(BaseModel):
    school: str
    degree: str | None = None
    major: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    description: str | None = None


class ProjectCreate(BaseModel):
    name: str
    summary: str | None = None
    description_md: str
    tags: list[str] = Field(default_factory=list)
    attachments: list[str] = Field(default_factory=list)


class ProfileCreate(BaseModel):
    full_name: str
    headline: str | None = None
    email: str | None = None
    phone: str | None = None
    summary: str | None = None
    education: list[EducationCreate] = Field(default_factory=list)
    skills: list[SkillCreate] = Field(default_factory=list)
    experiences: list[ExperienceCreate] = Field(default_factory=list)
    projects: list[ProjectCreate] = Field(default_factory=list)


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    headline: str | None = None
    email: str | None = None
    phone: str | None = None
    summary: str | None = None


class ProfileRead(BaseModel):
    id: int
    full_name: str
    headline: str | None = None
    email: str | None = None
    phone: str | None = None
    summary: str | None = None
    created_at: datetime
    updated_at: datetime


class ApplicationCreate(BaseModel):
    profile_id: int
    company: str
    title: str
    status: str = "applied"
    job_description: str | None = None
    job_url: str | None = None
    snapshot_path: str | None = None
    notes: str | None = None


class ApplicationStatusUpdate(BaseModel):
    status: str


class ApplicationRead(BaseModel):
    id: int
    profile_id: int
    company: str
    title: str
    status: str
    job_description: str | None = None
    job_url: str | None = None
    snapshot_path: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class ResumeDraftRequest(BaseModel):
    profile_id: int
    job_description: str
    template_key: str = "technical-minimal"


class ResumeDraftResponse(BaseModel):
    profile_id: int
    template_key: str
    matched_keywords: list[str]
    selected_projects: list[dict[str, Any]]
    selected_experiences: list[dict[str, Any]]
    summary: str
