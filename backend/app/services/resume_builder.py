from __future__ import annotations

from collections import Counter
from typing import Any


def _extract_keywords(text: str) -> list[str]:
    tokens = [token.strip(".,;:()[]{}<>/\\\"'!?\n\r").lower() for token in text.split()]
    return [token for token in tokens if len(token) > 2]


def _score_item(text: str, keywords: list[str]) -> int:
    normalized = text.lower()
    return sum(1 for keyword in keywords if keyword in normalized)


def build_resume_draft(profile: dict[str, Any], job_description: str, template_key: str = "technical-minimal") -> dict[str, Any]:
    keywords = _extract_keywords(job_description)
    keyword_counts = Counter(keywords)
    ranked_keywords = [keyword for keyword, _ in keyword_counts.most_common(12)]

    experiences = profile.get("experiences", [])
    projects = profile.get("projects", [])

    selected_experiences = sorted(
        experiences,
        key=lambda item: _score_item(f"{item.get('role', '')} {item.get('description_md', '')} {item.get('tags_json', '')}", ranked_keywords),
        reverse=True,
    )[:5]
    selected_projects = sorted(
        projects,
        key=lambda item: _score_item(f"{item.get('name', '')} {item.get('summary', '')} {item.get('description_md', '')}", ranked_keywords),
        reverse=True,
    )[:5]

    summary = profile.get("summary") or f"针对岗位需求自动整理的 {profile.get('full_name', '候选人')} 简历草稿"

    return {
        "profile_id": profile["id"],
        "template_key": template_key,
        "matched_keywords": ranked_keywords,
        "selected_projects": selected_projects,
        "selected_experiences": selected_experiences,
        "summary": summary,
    }
