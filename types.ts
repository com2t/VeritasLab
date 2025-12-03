
import React from 'react';
import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export type PanelType = 'data' | 'chat' | 'report';

export type TabType = 'chat' | 'list' | 'story' | 'report';

// Re-exporting User type from Firebase for convenience
export type { User };

export interface AlarmSettings {
    isEnabled: boolean;
    days: number[]; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    time: string;   // "HH:MM" 24-hour format
    message: string;
}

export interface UserProfile {
    uid: string;
    name: string;
    nickname?: string; // 친근한 호칭/별명
    gender?: 'male' | 'female';
    dateOfBirth?: string;
    school?: string;
    major?: string;
    phoneNumber?: string;
    interestedJob?: string;
    // 온보딩 완료 여부 플래그
    isOnboardingFinished?: boolean;
    
    // 친밀도 시스템 (Friendship Level)
    friendshipScore?: number;
    streakDays?: number;
    lastInteractionDate?: string; // For streak calculation (YYYY-MM-DD)
    lastChatDate?: string; // To prevent spamming daily chat points (YYYY-MM-DD)

    // 알람 설정
    alarmSettings?: AlarmSettings;
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
    deletedAt?: string | null; // Soft delete field
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

// [STEP 4] NLP Unit Type for evidence tracking
export interface NLPUnit {
    text: string;
    starType?: "S" | "T" | "A" | "R";
    skills: string[]; // Skill IDs
    jobs: string[];   // Job IDs
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
    deletedAt?: string | null; // Soft delete field
    tags?: string[];
    
    // [STEP 4] 자동 태깅 분석 데이터 (NCS 기반)
    skills?: string[]; // e.g. ["COM001", "MKT003"]
    jobs?: string[];   // e.g. ["JOB002"]
    nlpUnits?: NLPUnit[]; // 문장 단위 분석 데이터
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

// --- New Types for Advanced Report ---

export interface KeywordMetric {
    text: string;
    value: number; // 1-100 score for visualization size
    category: 'interest' | 'job_related' | 'general';
}

export interface RadarMetric {
    axis: string; // Competency Name
    myScore: number;
    avgScore: number; // Industry Average
    topScore: number; // Top Performer
}

export interface GapAction {
    skillName: string;
    gapDescription: string;
    methodology: string; // "How to think"
    recommendedActivity: string; // Specific activity category/example
}

export interface GrowthPoint {
    year: string;
    score: number; // 0-100 growth index
    isProjection: boolean; // True if future prediction
    milestone?: string; // Optional label for the point
    description?: string; // Evidence or reason for the score
    relatedExperienceId?: string; // Optional ID to link back to the source experience
}

export interface SWOTData {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    industryTrends: string; // Market situation text
}

export interface ReportData {
    // Advanced Analysis Fields
    keywordAnalysis?: {
        wordCloud: KeywordMetric[];
        jobKeywords: KeywordMetric[];
    };
    competencyRadar?: {
        targetJob: string;
        data: RadarMetric[];
    };
    gapAnalysis?: GapAction[];
    growthCurve?: GrowthPoint[];
    swotAnalysis?: SWOTData;

    // Original Fields
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

// --- Diary Entry Type ---
export interface DiaryEntry {
    id: string;
    date: string; // YYYY-MM-DD
    title: string;
    content: string;
    mood: string; // Emoji
    tags: string[];
    createdAt: string;
}

// --- Calendar Event Type ---
export interface CalendarEvent {
    id: string;
    date: string; // "YYYY-MM-DD"
    time?: string; // "HH:MM" (Optional)
    title: string;
    type: 'PAST_RECORD' | 'FUTURE_PLAN'; // 과거 이력 vs 미래 계획
    category: 'MEETING' | 'TRAVEL' | 'STUDY' | 'DEADLINE' | 'ETC';
    description?: string;
    createdAt?: string;
    isHandled?: boolean; // Flag to indicate if the AI has already asked about this event
}