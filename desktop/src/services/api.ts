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

export type ApplicationRecord = {
  id: number;
  profile_id: number;
  company: string;
  title: string;
  status: string;
  job_description?: string | null;
  job_url?: string | null;
  snapshot_path?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationCreatePayload = {
  profile_id: number;
  company: string;
  title: string;
  status?: string;
  job_description?: string | null;
  job_url?: string | null;
  snapshot_path?: string | null;
  notes?: string | null;
};

export type ProfileSummary = {
  id: number;
  full_name: string;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  summary?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileDetail = ProfileSummary & {
  skills: Array<{
    id?: number;
    name: string;
    category?: string | null;
    tags_json?: string;
  }>;
  education: Array<{
    id?: number;
    school: string;
    degree?: string | null;
    major?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string | null;
  }>;
  experiences: Array<{
    id?: number;
    role: string;
    company?: string | null;
    description_md: string;
    tags_json?: string;
    start_date?: string | null;
    end_date?: string | null;
  }>;
  projects: Array<{
    id?: number;
    name: string;
    summary?: string | null;
    description_md: string;
    tags_json?: string;
    attachments_json?: string;
  }>;
};

export type ProfileUpdatePayload = {
  full_name?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  summary?: string | null;
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

export async function listProfiles() {
  return requestJson<ProfileSummary[]>("/profiles");
}

export async function getProfile(profileId: number) {
  return requestJson<ProfileDetail>(`/profiles/${profileId}`);
}

export async function updateProfile(
  profileId: number,
  payload: ProfileUpdatePayload,
) {
  return requestJson<ProfileDetail>(`/profiles/${profileId}`, {
    method: "PATCH",
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

export async function listApplications(profileId?: number) {
  const query = profileId ? `?profile_id=${profileId}` : "";
  return requestJson<ApplicationRecord[]>(`/applications${query}`);
}

export async function createApplication(payload: ApplicationCreatePayload) {
  return requestJson<ApplicationRecord>("/applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateApplicationStatus(
  applicationId: number,
  status: string,
) {
  return requestJson<ApplicationRecord>(
    `/applications/${applicationId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
}
