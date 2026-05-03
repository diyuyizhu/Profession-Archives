from __future__ import annotations


def test_health_endpoint(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_profile_creation_and_resume_draft_flow(client) -> None:
    profile_payload = {
        "full_name": "张三",
        "headline": "后端工程师",
        "email": "zhangsan@example.com",
        "phone": "13800000000",
        "summary": "擅长 Python、FastAPI 与 SQLite 的本地化工具构建。",
        "education": [
            {
                "school": "示例大学",
                "degree": "本科",
                "major": "计算机科学",
                "start_date": "2018-09",
                "end_date": "2022-06",
                "description": "主修信息系统与软件工程。",
            }
        ],
        "skills": [
            {"name": "Python", "category": "backend", "tags": ["fastapi", "sqlite"]},
            {"name": "SQLite", "category": "database", "tags": ["local-first"]},
        ],
        "experiences": [
            {
                "role": "后端开发工程师",
                "company": "某科技公司",
                "description_md": "负责 FastAPI 接口、SQLite 设计与本地文件管理。",
                "tags": ["python", "fastapi", "sqlite"],
                "start_date": "2022-07",
                "end_date": "2024-12",
            }
        ],
        "projects": [
            {
                "name": "本地简历系统",
                "summary": "岗位特化简历生成器",
                "description_md": "为不同 JD 自动筛选项目并生成 A4 PDF。",
                "tags": ["resume", "ats", "pdf"],
                "attachments": ["portfolio.pdf"],
            }
        ],
    }

    create_response = client.post("/profiles", json=profile_payload)
    assert create_response.status_code == 200
    created_profile = create_response.json()
    assert created_profile["full_name"] == "张三"

    profile_id = created_profile["id"]
    detail_response = client.get(f"/profiles/{profile_id}")
    assert detail_response.status_code == 200
    profile_detail = detail_response.json()
    assert len(profile_detail["education"]) == 1
    assert profile_detail["projects"][0]["name"] == "本地简历系统"

    draft_response = client.post(
        "/resume/draft",
        json={
            "profile_id": profile_id,
            "job_description": "We are hiring a Python FastAPI engineer for SQLite-based local tooling and ATS optimization.",
            "template_key": "technical-minimal",
        },
    )
    assert draft_response.status_code == 200
    draft = draft_response.json()
    assert draft["profile_id"] == profile_id
    assert draft["template_key"] == "technical-minimal"
    assert "python" in draft["matched_keywords"]
    assert draft["selected_projects"]
    assert draft["selected_experiences"]


def test_application_tracking(client) -> None:
    profile_response = client.post(
        "/profiles",
        json={
            "full_name": "李四",
            "headline": "全栈开发",
            "education": [],
            "skills": [],
            "experiences": [],
            "projects": [],
        },
    )
    profile_id = profile_response.json()["id"]

    application_response = client.post(
        "/applications",
        json={
            "profile_id": profile_id,
            "company": "示例公司",
            "title": "Python Backend Engineer",
            "status": "applied",
            "job_description": "Build local-first tooling.",
            "job_url": "https://example.com/jobs/1",
            "snapshot_path": "/snapshots/example-job.html",
            "notes": "投递后等待初筛。",
        },
    )
    assert application_response.status_code == 200
    application = application_response.json()
    assert application["company"] == "示例公司"

    list_response = client.get(f"/applications?profile_id={profile_id}")
    assert list_response.status_code == 200
    applications = list_response.json()
    assert len(applications) == 1
    assert applications[0]["status"] == "applied"
