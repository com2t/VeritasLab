
import React from 'react';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export type PanelType = 'data' | 'chat' | 'report';

export type TabType = 'chat' | 'list' | 'story' | 'report';

// Re-exporting User type from Firebase for convenience
export type { User };

export interface UserProfile {
    uid: string;
    name: string;
    gender?: 'male' | 'female';
    dateOfBirth?: string;
    school?: string;
    major?: string;
    phoneNumber?: string;
    interestedJob?: string;
    // 온보딩 완료 여부 플래그
    isOnboardingFinished?: boolean;
}

export interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    component?: React.ReactNode;
    createdAt?: string;
}

export interface ChatSession {
    id: string;
    title: string;
    lastMessage: string;
    createdAt: string;
    updatedAt?: string;
}

export interface BasicExperienceData {
    what: string;
    name: string;
    when: string;
    where: string;
    who: string;
    why: string;
    how: string;
    result: string;
    insight: string;
    type: string;
}

export interface AutofillResponse {
    completedData: Partial<BasicExperienceData>;
    followUpQuestions: {
        field: keyof BasicExperienceData;
        question: string;
    }[];
}


export interface StoryData {
    situation: string;
    task: string;
    action: string;
    result_quantitative: string;
    result_qualitative: string;
    learning: string;
    competency: string;
    job: string;
}

export interface NLPUnit {
    text: string;
    starType?: "S" | "T" | "A" | "R";
    skills: string[];
    jobs: string[];
}

export interface Experience {
    id: string;
    type: 'basic' | 'story';
    sequence_number: number;
    activity_date: string;
    activity_type: string;
    activity_name: string;
    story_summary: string;
    result_achievement: string;
    key_insight: string;
    detailed_content: string;
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
    how: string;
    story_title: string;
    core_competency: string;
    job_alignment: string;
    situation: string;
    task: string;
    action: string;
    result_quantitative: string;
    result_qualitative: string;
    learning: string;
    createdAt: string;
    tags?: string[];
    
    // [STEP 4] 자동 태깅 분석 데이터
    skills?: string[];
    jobs?: string[];
    nlpUnits?: NLPUnit[];
}

export interface ExperienceSummary {
    title: string;
    summary: string;
}

export interface ConsultantComment {
    author: string;
    comment: string;
    createdAt: string; 
}

export interface ReportSection {
    title: string;
    content: string;
    examples: string[];
    skills: string[];
}

export interface JobRecommendation {
    jobTitle: string;
    reason: string;
    matchingSkills: string[];
}

export interface ReportData {
    strengths: ReportSection;
    growthOpportunities: ReportSection;
    jobRecommendations: JobRecommendation[];
    summary: string;
    experienceSummaries: ExperienceSummary[];
    storySummaries: ExperienceSummary[];
    consultantComments: ConsultantComment[];
}

export interface SharedReport extends ReportData {
    userId: string;
    createdAt: string;
}

// [STEP 5] 직무 적합도 분석 데이터 타입
export interface JobFitAnalysis {
    targetJob: string;
    fitScore: number;
    summary: string;
    radarChart: {
        axis: string;
        myScore: number;
        avgScore: number;
        maxScore: number;
    }[];
    keyExperiences: string[];
    topStrongSkills: string[];
    weakSkills: {
        skill: string;
        toDo: string[];
    }[];
    rank: number;
}
