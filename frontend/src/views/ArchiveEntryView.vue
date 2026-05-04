<template>
  <div class="space-y-6">
    <!-- Hero Section -->
    <div
      class="hero min-h-64 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg border border-primary/20"
    >
      <div class="hero-content text-center">
        <div class="max-w-md">
          <h1 class="text-5xl font-bold glow-text mb-4">创建档案</h1>
          <p class="py-6 text-primary/70">
            详细填写你的职业信息，为针对性简历生成做准备
          </p>
        </div>
      </div>
    </div>

    <!-- Form Section -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Basic Info Card -->
      <div
        class="lg:col-span-3 card bg-neutral border border-primary/20 shadow-xl"
      >
        <div class="card-body">
          <h2 class="card-title text-primary">基本信息</h2>
          <div class="form-control">
            <label class="label"><span class="label-text">姓名 *</span></label>
            <input
              v-model="form.full_name"
              type="text"
              placeholder="请输入全名"
              class="input input-bordered bg-neutral/50 border-primary/30"
              required
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text">职位</span></label>
              <input
                v-model="form.headline"
                type="text"
                placeholder="e.g. 后端工程师"
                class="input input-bordered bg-neutral/50 border-primary/30"
              />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">邮箱</span></label>
              <input
                v-model="form.email"
                type="email"
                placeholder="your@email.com"
                class="input input-bordered bg-neutral/50 border-primary/30"
              />
            </div>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">电话</span></label>
            <input
              v-model="form.phone"
              type="tel"
              placeholder="+86 xxxxx"
              class="input input-bordered bg-neutral/50 border-primary/30"
            />
          </div>
          <div class="form-control">
            <label class="label"
              ><span class="label-text">个人总结</span></label
            >
            <textarea
              v-model="form.summary"
              class="textarea textarea-bordered bg-neutral/50 border-primary/30 h-24"
              placeholder="简要描述你的职业背景和特长..."
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Skills Card -->
      <div class="card bg-neutral border border-primary/20 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-primary text-lg">技能</h2>
          <div
            v-for="(skill, idx) in form.skills"
            :key="idx"
            class="space-y-2 mb-4 p-3 bg-neutral/50 rounded"
          >
            <input
              v-model="skill.name"
              type="text"
              placeholder="技能名称"
              class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
            />
            <input
              v-model="skill.category"
              type="text"
              placeholder="分类"
              class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
            />
            <button
              @click="removeSkill(idx)"
              class="btn btn-sm btn-ghost btn-outline"
            >
              移除
            </button>
          </div>
          <button
            @click="addSkill"
            class="btn btn-sm btn-primary btn-outline w-full"
          >
            + 添加技能
          </button>
        </div>
      </div>

      <!-- Education Card -->
      <div class="card bg-neutral border border-primary/20 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-secondary text-lg">教育</h2>
          <div
            v-for="(edu, idx) in form.education"
            :key="idx"
            class="space-y-2 mb-4 p-3 bg-neutral/50 rounded"
          >
            <input
              v-model="edu.school"
              type="text"
              placeholder="学校"
              class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
            />
            <input
              v-model="edu.degree"
              type="text"
              placeholder="学位"
              class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
            />
            <input
              v-model="edu.start_date"
              type="month"
              class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
            />
            <button
              @click="removeEducation(idx)"
              class="btn btn-sm btn-ghost btn-outline"
            >
              移除
            </button>
          </div>
          <button
            @click="addEducation"
            class="btn btn-sm btn-secondary btn-outline w-full"
          >
            + 添加教育
          </button>
        </div>
      </div>

      <!-- Experience & Projects Card -->
      <div
        class="lg:col-span-3 card bg-neutral border border-primary/20 shadow-xl"
      >
        <div class="card-body">
          <div class="tabs">
            <input
              type="radio"
              name="exp_tab"
              class="tab"
              aria-label="工作经历"
              checked
            />
            <div class="tab-content p-4">
              <div
                v-for="(exp, idx) in form.experiences"
                :key="`exp-${idx}`"
                class="space-y-2 mb-4 p-3 bg-neutral/50 rounded"
              >
                <input
                  v-model="exp.role"
                  type="text"
                  placeholder="职位"
                  class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
                />
                <input
                  v-model="exp.company"
                  type="text"
                  placeholder="公司"
                  class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
                />
                <textarea
                  v-model="exp.description_md"
                  placeholder="职责描述"
                  class="textarea textarea-bordered textarea-sm bg-neutral/70 border-primary/30 w-full"
                ></textarea>
                <button
                  @click="removeExperience(idx)"
                  class="btn btn-sm btn-ghost btn-outline"
                >
                  移除
                </button>
              </div>
              <button
                @click="addExperience"
                class="btn btn-sm btn-accent btn-outline w-full"
              >
                + 添加工作经历
              </button>
            </div>

            <input type="radio" name="exp_tab" class="tab" aria-label="项目" />
            <div class="tab-content p-4">
              <div
                v-for="(proj, idx) in form.projects"
                :key="`proj-${idx}`"
                class="space-y-2 mb-4 p-3 bg-neutral/50 rounded"
              >
                <input
                  v-model="proj.name"
                  type="text"
                  placeholder="项目名称"
                  class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
                />
                <input
                  v-model="proj.summary"
                  type="text"
                  placeholder="简介"
                  class="input input-bordered input-sm bg-neutral/70 border-primary/30 w-full"
                />
                <textarea
                  v-model="proj.description_md"
                  placeholder="项目描述"
                  class="textarea textarea-bordered textarea-sm bg-neutral/70 border-primary/30 w-full"
                ></textarea>
                <button
                  @click="removeProject(idx)"
                  class="btn btn-sm btn-ghost btn-outline"
                >
                  移除
                </button>
              </div>
              <button
                @click="addProject"
                class="btn btn-sm btn-accent btn-outline w-full"
              >
                + 添加项目
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Submit Button -->
    <div class="flex justify-end gap-4">
      <button class="btn btn-outline">取消</button>
      <button
        @click="submitArchive"
        :disabled="isLoading"
        class="btn btn-primary"
      >
        <span v-if="isLoading" class="loading loading-spinner"></span>
        保存档案
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { createArchive, ProfilePayload } from "../services/api";

const isLoading = ref(false);

const form = ref<ProfilePayload>({
  full_name: "",
  headline: "",
  email: "",
  phone: "",
  summary: "",
  education: [],
  skills: [],
  experiences: [],
  projects: [],
});

const addSkill = () => {
  form.value.skills.push({ name: "", category: "", tags: [] });
};

const removeSkill = (idx: number) => {
  form.value.skills.splice(idx, 1);
};

const addEducation = () => {
  form.value.education.push({
    school: "",
    degree: "",
    major: "",
    start_date: "",
    end_date: "",
  });
};

const removeEducation = (idx: number) => {
  form.value.education.splice(idx, 1);
};

const addExperience = () => {
  form.value.experiences.push({
    role: "",
    company: "",
    description_md: "",
    tags: [],
    start_date: "",
    end_date: "",
  });
};

const removeExperience = (idx: number) => {
  form.value.experiences.splice(idx, 1);
};

const addProject = () => {
  form.value.projects.push({
    name: "",
    summary: "",
    description_md: "",
    tags: [],
    attachments: [],
  });
};

const removeProject = (idx: number) => {
  form.value.projects.splice(idx, 1);
};

const submitArchive = async () => {
  if (!form.value.full_name) {
    alert("请填写姓名");
    return;
  }

  isLoading.value = true;
  try {
    await createArchive(form.value);
    alert("档案已保存！");
    // Reset form
    form.value = {
      full_name: "",
      headline: "",
      email: "",
      phone: "",
      summary: "",
      education: [],
      skills: [],
      experiences: [],
      projects: [],
    };
  } catch (error) {
    alert("保存失败，请重试");
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped></style>
