from __future__ import annotations

from fastapi import FastAPI, HTTPException

from backend.app.db import init_db
from backend.app.schemas import ApplicationCreate, ApplicationRead, ApplicationStatusUpdate, ProfileCreate, ProfileRead, ProfileUpdate, ResumeDraftRequest, ResumeDraftResponse
from backend.app.services.archive_store import create_application, create_profile, get_profile, list_applications, list_profiles, update_application_status, update_profile
from backend.app.services.resume_builder import build_resume_draft


app = FastAPI(title="Profession Archives API", version="0.1.0")


@app.on_event("startup")
def startup_event() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/profiles", response_model=ProfileRead)
def api_create_profile(payload: ProfileCreate) -> dict:
    return create_profile(payload)


@app.get("/profiles", response_model=list[ProfileRead])
def api_list_profiles() -> list[dict]:
    return list_profiles()


@app.get("/profiles/{profile_id}")
def api_get_profile(profile_id: int) -> dict:
    profile = get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.patch("/profiles/{profile_id}", response_model=ProfileRead)
def api_update_profile(profile_id: int, payload: ProfileUpdate) -> dict:
    profile = update_profile(profile_id, payload)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.post("/applications", response_model=ApplicationRead)
def api_create_application(payload: ApplicationCreate) -> dict:
    return create_application(payload)


@app.get("/applications", response_model=list[ApplicationRead])
def api_list_applications(profile_id: int | None = None) -> list[dict]:
    return list_applications(profile_id=profile_id)


@app.patch("/applications/{application_id}/status", response_model=ApplicationRead)
def api_update_application_status(application_id: int, payload: ApplicationStatusUpdate) -> dict:
    application = update_application_status(application_id, payload)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@app.post("/resume/draft", response_model=ResumeDraftResponse)
def api_build_resume_draft(payload: ResumeDraftRequest) -> dict:
    profile = get_profile(payload.profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return build_resume_draft(profile, payload.job_description, payload.template_key)
