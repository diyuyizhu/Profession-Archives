from __future__ import annotations

from typing import Any

from backend.app.db import db_session, dumps_json, row_to_dict
from backend.app.schemas import ApplicationCreate, ApplicationStatusUpdate, ProfileCreate, ProfileUpdate


def _read_profile(connection, profile_id: int) -> dict[str, Any] | None:
    profile = connection.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    if profile is None:
        return None

    skills = connection.execute("SELECT * FROM skills WHERE profile_id = ? ORDER BY id ASC", (profile_id,)).fetchall()
    education = connection.execute("SELECT * FROM education WHERE profile_id = ? ORDER BY id ASC", (profile_id,)).fetchall()
    experiences = connection.execute(
        "SELECT * FROM experiences WHERE profile_id = ? ORDER BY id ASC",
        (profile_id,),
    ).fetchall()
    projects = connection.execute(
        "SELECT * FROM projects WHERE profile_id = ? ORDER BY id ASC",
        (profile_id,),
    ).fetchall()

    result = dict(profile)
    result["skills"] = [dict(row) for row in skills]
    result["education"] = [dict(row) for row in education]
    result["experiences"] = [dict(row) for row in experiences]
    result["projects"] = [dict(row) for row in projects]
    return result


def create_profile(payload: ProfileCreate) -> dict[str, Any]:
    with db_session() as connection:
        cursor = connection.execute(
            """
            INSERT INTO profiles (full_name, headline, email, phone, summary)
            VALUES (?, ?, ?, ?, ?)
            """,
            (payload.full_name, payload.headline, payload.email, payload.phone, payload.summary),
        )
        profile_id = cursor.lastrowid

        for skill in payload.skills:
            connection.execute(
                """
                INSERT INTO skills (profile_id, name, category, tags_json)
                VALUES (?, ?, ?, ?)
                """,
                (profile_id, skill.name, skill.category, dumps_json(skill.tags)),
            )

        for education in payload.education:
            connection.execute(
                """
                INSERT INTO education (profile_id, school, degree, major, start_date, end_date, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_id,
                    education.school,
                    education.degree,
                    education.major,
                    education.start_date,
                    education.end_date,
                    education.description,
                ),
            )

        for experience in payload.experiences:
            connection.execute(
                """
                INSERT INTO experiences (profile_id, role, company, description_md, tags_json, start_date, end_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_id,
                    experience.role,
                    experience.company,
                    experience.description_md,
                    dumps_json(experience.tags),
                    experience.start_date,
                    experience.end_date,
                ),
            )

        for project in payload.projects:
            connection.execute(
                """
                INSERT INTO projects (profile_id, name, summary, description_md, tags_json, attachments_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_id,
                    project.name,
                    project.summary,
                    project.description_md,
                    dumps_json(project.tags),
                    dumps_json(project.attachments),
                ),
            )

        profile = _read_profile(connection, profile_id)
        return profile or {"id": profile_id}


def list_profiles() -> list[dict[str, Any]]:
    with db_session() as connection:
        rows = connection.execute("SELECT * FROM profiles ORDER BY datetime(created_at) DESC").fetchall()
        return [dict(row) for row in rows]


def get_profile(profile_id: int) -> dict[str, Any] | None:
    with db_session() as connection:
        return _read_profile(connection, profile_id)


def update_profile(profile_id: int, payload: ProfileUpdate) -> dict[str, Any] | None:
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return get_profile(profile_id)

    with db_session() as connection:
        existing = connection.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        if existing is None:
            return None

        connection.execute(
            """
            UPDATE profiles
            SET full_name = COALESCE(?, full_name),
                headline = COALESCE(?, headline),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                summary = COALESCE(?, summary),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                updates.get("full_name"),
                updates.get("headline"),
                updates.get("email"),
                updates.get("phone"),
                updates.get("summary"),
                profile_id,
            ),
        )
        return _read_profile(connection, profile_id)


def create_application(payload: ApplicationCreate) -> dict[str, Any]:
    with db_session() as connection:
        cursor = connection.execute(
            """
            INSERT INTO applications (profile_id, company, title, status, job_description, job_url, snapshot_path, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.profile_id,
                payload.company,
                payload.title,
                payload.status,
                payload.job_description,
                payload.job_url,
                payload.snapshot_path,
                payload.notes,
            ),
        )
        application_id = cursor.lastrowid
        application = connection.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        return row_to_dict(application) or {"id": application_id}


def list_applications(profile_id: int | None = None) -> list[dict[str, Any]]:
    with db_session() as connection:
        if profile_id is None:
            rows = connection.execute("SELECT * FROM applications ORDER BY datetime(created_at) DESC").fetchall()
        else:
            rows = connection.execute(
                "SELECT * FROM applications WHERE profile_id = ? ORDER BY datetime(created_at) DESC",
                (profile_id,),
            ).fetchall()
        return [dict(row) for row in rows]


def update_application_status(application_id: int, payload: ApplicationStatusUpdate) -> dict[str, Any] | None:
    with db_session() as connection:
        connection.execute(
            """
            UPDATE applications
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (payload.status, application_id),
        )
        application = connection.execute("SELECT * FROM applications WHERE id = ?", (application_id,)).fetchone()
        return row_to_dict(application)
