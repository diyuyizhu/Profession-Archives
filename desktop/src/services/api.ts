export type EducationItem = {
  school: string;
  degree?: string;
  major?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
};

export type ArchivePayload = {
  full_name: string;
  headline?: string;
  email?: string;
  phone?: string;
  summary?: string;
  education: EducationItem[];
  skills: Array<{ name: string; category?: string; tags: string[] }>;
  experiences: Array<{
    role: string;
    company?: string;
    description_md: string;
    tags: string[];
    start_date?: string;
    end_date?: string;
  }>;
  projects: Array<{
    name: string;
    summary?: string;
    description_md: string;
    tags: string[];
    attachments: string[];
  }>;
};

export type ResumeDraftRequest = {
  profile_id: number;
  job_description: string;
  template_key: string;
};

const baseUrl = "http://127.0.0.1:8000";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function createArchive(payload: ArchivePayload) {
  return requestJson<{ id: number }>("/profiles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function generateResumeDraft(payload: ResumeDraftRequest) {
  return requestJson<{
    matched_keywords: string[];
    selected_projects: unknown[];
    selected_experiences: unknown[];
    summary: string;
  }>("/resume/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
