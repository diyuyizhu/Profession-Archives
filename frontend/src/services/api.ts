import axios from "axios";

// Determine API base URL based on environment
// In PyWebView (exe), the backend is at the same origin
// In dev/web mode, use proxy to /api
const getBaseURL = () => {
  // Check if running in PyWebView (window.location.protocol will be 'http:' or 'https:')
  // and if backend is on same origin
  if (typeof window !== "undefined") {
    const isDev =
      window.location.hostname === "localhost" &&
      window.location.port === "5173";
    return isDev ? "/api" : "";
  }
  return "/api";
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000,
});

// Profile types
export interface EducationItem {
  school: string;
  degree: string;
  major: string;
  start_date: string;
  end_date: string;
  description?: string;
}

export interface SkillItem {
  name: string;
  category: string;
  tags?: string[];
}

export interface ExperienceItem {
  role: string;
  company: string;
  description_md?: string;
  tags?: string[];
  start_date: string;
  end_date: string;
}

export interface ProjectItem {
  name: string;
  summary: string;
  description_md?: string;
  tags?: string[];
  attachments?: string[];
}

export interface ProfilePayload {
  full_name: string;
  headline?: string;
  email?: string;
  phone?: string;
  summary?: string;
  education: EducationItem[];
  skills: SkillItem[];
  experiences: ExperienceItem[];
  projects: ProjectItem[];
}

export interface ProfileDetail extends ProfilePayload {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  full_name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  summary?: string;
}

export interface ApplicationPayload {
  profile_id: string;
  job_title: string;
  company: string;
  status?: string;
  applied_date?: string;
}

export interface ApplicationRecord extends ApplicationPayload {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface ResumeDraftRequest {
  profile_id: string;
  job_description: string;
  template_key?: string;
}

export interface ResumeDraftResponse {
  profile_id: string;
  matched_keywords: string[];
  selected_projects: ProjectItem[];
  selected_experiences: ExperienceItem[];
  summary: string;
}

// Profile APIs
export async function createArchive(payload: ProfilePayload) {
  const { data } = await api.post("/profiles", payload);
  return data;
}

export async function listProfiles() {
  const { data } = await api.get("/profiles");
  return data;
}

export async function getProfile(profileId: string) {
  const { data } = await api.get(`/profiles/${profileId}`);
  return data;
}

export async function updateProfile(profileId: string, payload: ProfileUpdate) {
  const { data } = await api.patch(`/profiles/${profileId}`, payload);
  return data;
}

// Application APIs
export async function createApplication(payload: ApplicationPayload) {
  const { data } = await api.post("/applications", payload);
  return data;
}

export async function listApplications(profileId?: string) {
  const params = profileId ? { profile_id: profileId } : {};
  const { data } = await api.get("/applications", { params });
  return data;
}

export async function updateApplicationStatus(
  applicationId: string,
  status: string,
) {
  const { data } = await api.patch(`/applications/${applicationId}/status`, {
    status,
  });
  return data;
}

// Resume draft
export async function generateResumeDraft(payload: ResumeDraftRequest) {
  const { data } = await api.post("/resume/draft", payload);
  return data as ResumeDraftResponse;
}

// Health check
export async function checkHealth() {
  try {
    await api.get("/health");
    return true;
  } catch {
    return false;
  }
}
