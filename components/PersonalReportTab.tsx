
import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Experience, ReportData, User, JobFitAnalysis } from '../types';
import { db, addDoc, collection } from '../firebase';
import { LoadingSpinner, ChartPieIcon, ThumbUpIcon, ArrowTrendingUpIcon, AcademicCapIcon, SparklesIcon, ShareIcon, ClipboardIcon } from './icons';
import JobFitAnalysisView from './JobFitAnalysisView';

interface PersonalReportTabProps {
    experiences: Experience[];
    user: User | null;
    report: ReportData | null;
    setReport: (report: ReportData | null) => void;
    jobFitData?: JobFitAnalysis | null; // New Prop
}

const REPORT_SYSTEM_INSTRUCTION = `You are an expert career coach AI. Your task is to analyze a user's collection of personal and professional experiences and generate a comprehensive, insightful, and actionable report.
The user's experiences will be provided as a JSON array.
Based on this data, you MUST generate a response in a single, valid JSON object format. Do not include any text before or after the JSON object. Do not use markdown formatting.

The JSON object must have the following structure:
{
  "strengths": {
    "title": "핵심 강점",
    "content": "A summary of the user's key strengths, written in Korean. Be specific and positive.",
    "examples": ["A specific example from the user's experiences that demonstrates a strength (in Korean).", "Another specific example (in Korean)."],
    "skills": ["A list of specific, transferable skills identified from the experiences, e.g., '프로젝트 관리', '데이터 분석', '고객 커뮤니케이션'."]
  },
  "growthOpportunities": {
    "title": "성장 기회",
    "content": "Constructive feedback on areas where the user could grow, framed positively as 'opportunities'. Written in Korean.",
    "examples": ["A suggestion for an action the user can take, e.g., '리더십 경험을 공식적인 프로젝트 관리 방법론 학습으로 보완해 보세요.'", "Another actionable suggestion (in Korean)."],
    "skills": ["A list of skills to develop, e.g., '전략적 기획', 'UX 리서치'."]
  },
  "jobRecommendations": [
    {
      "jobTitle": "A specific job title recommendation (in Korean), e.g., '프로덕트 매니저'.",
      "reason": "A detailed explanation of why this job is a good fit, based on the provided experiences (in Korean).",
      "matchingSkills": ["A list of the user's skills from the 'strengths' section that align with this job recommendation."]
    }
  ],
  "experienceSummaries": [
      { "title": "Experience name (e.g., 'OO 프로젝트')", "summary": "A one-sentence summary of this basic experience in Korean." }
  ],
  "storySummaries": [
      { "title": "Story title (e.g., 'OOO 스토리')", "summary": "A one-sentence summary of this STAR story in Korean." }
  ],
  "consultantComments": [],
  "summary": "A final, encouraging summary and overall coaching message for the user's career path, written in Korean."
}

Analyze the data deeply. Create a concise summary for EACH basic experience and EACH story experience. Synthesize information across multiple experiences to identify consistent patterns, themes, and transferable skills. Make your advice specific and actionable.
`;

const tryParseJSON = <T, >(jsonString: string): T | null => {
    try {
        const o = JSON.parse(jsonString);
        return o && typeof o === "object" ? o : null;
    } catch (e) {
        console.error("JSON parsing error:", e);
        return null;
    }
};

const SkillTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold mr-2 mb-2 px-2.5 py-1 rounded-full">
        {children}
    </span>
);

const PersonalReportTab: React.FC<PersonalReportTabProps> = ({ experiences, user, report, setReport, jobFitData }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shareableLink, setShareableLink] = useState<string | null>(null);
    const [isLinkCopied, setIsLinkCopied] = useState(false);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const handleGenerateReport = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setReport(null);
        setShareableLink(null);

        try {
            // FIX: Circular structure error prevention.
            // Explicitly map only the necessary string/number fields to a new object.
            // This removes any potential internal React or Firestore object references.
            const cleanExperiences = experiences.map(exp => ({
                activity_name: exp.activity_name || '',
                activity_date: exp.activity_date || '',
                activity_type: exp.activity_type || '',
                story_summary: exp.story_summary || '',
                result_achievement: exp.result_achievement || '',
                key_insight: exp.key_insight || '',
                detailed_content: exp.detailed_content || '',
                story_title: exp.story_title || '',
                core_competency: exp.core_competency || '',
                job_alignment: exp.job_alignment || '',
                situation: exp.situation || '',
                task: exp.task || '',
                action: exp.action || '',
                result_quantitative: exp.result_quantitative || '',
                result_qualitative: exp.result_qualitative || '',
                learning: exp.learning || '',
                skills: exp.skills || [],
                jobs: exp.jobs || [],
                type: exp.type || 'basic'
            }));

            const experiencesString = JSON.stringify(cleanExperiences, null, 2);
            const prompt = `Here are my experiences:\n${experiencesString}`;
            
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: REPORT_SYSTEM_INSTRUCTION,
                    responseMimeType: "application/json",
                },
            });

            const reportData = tryParseJSON<ReportData>(result.text);

            if (reportData) {
                setReport(reportData);
            } else {
                throw new Error("AI가 유효한 형식의 리포트를 생성하지 못했습니다. 다시 시도해주세요.");
            }

        } catch (err) {
            console.error("Report generation failed:", err);
            setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, [experiences, ai.models, setReport]);

    const handleShareReport = async () => {
        if (!report || !user) return;
        setIsLoading(true);
        try {
            const docRef = await addDoc(collection(db, 'sharedReports'), {
                ...report,
                userId: user.uid,
                createdAt: new Date().toISOString(),
            });
            const link = `${window.location.origin}${window.location.pathname}?reportId=${docRef.id}`;
            setShareableLink(link);
        } catch (error) {
            console.error("Failed to share report:", error);
            setError("리포트 공유에 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const copyLinkToClipboard = () => {
        if (shareableLink) {
            navigator.clipboard.writeText(shareableLink).then(() => {
                setIsLinkCopied(true);
                setTimeout(() => setIsLinkCopied(false), 2000);
            });
        }
    };

    const renderReport = () => {
        if (!report) return null;

        return (
            <div className="space-y-6 animate-fade-in-up">
                <div className="text-center mb-8 pt-4">
                    <h2 className="text-2xl font-bold text-slate-800">종합 커리어 리포트</h2>
                    <p className="text-slate-500 mt-2">나의 경험을 전체적으로 분석한 AI 리포트입니다.</p>
                </div>
                {/* FIX: Add safety checks (|| []) for all arrays to prevent 'map of null' errors */}
                <ReportSection icon={<ThumbUpIcon className="w-8 h-8 text-green-500" />} title={report.strengths?.title || '핵심 강점'}>
                    <div className="mb-4">{(report.strengths?.skills || []).map((skill, idx) => <SkillTag key={idx}>{skill}</SkillTag>)}</div>
                    <p className="mb-4">{report.strengths?.content}</p>
                    <ul className="list-disc list-inside space-y-2 text-sm">{(report.strengths?.examples || []).map((ex, i) => <li key={i}>{ex}</li>)}</ul>
                </ReportSection>
                <ReportSection icon={<ArrowTrendingUpIcon className="w-8 h-8 text-blue-500" />} title={report.growthOpportunities?.title || '성장 기회'}>
                    <div className="mb-4">{(report.growthOpportunities?.skills || []).map((skill, idx) => <SkillTag key={idx}>{skill}</SkillTag>)}</div>
                    <p className="mb-4">{report.growthOpportunities?.content}</p>
                    <ul className="list-disc list-inside space-y-2 text-sm">{(report.growthOpportunities?.examples || []).map((ex, i) => <li key={i}>{ex}</li>)}</ul>
                </ReportSection>
                <ReportSection icon={<AcademicCapIcon className="w-8 h-8 text-indigo-500" />} title="추천 직무">
                    <div className="space-y-4">
                        {(report.jobRecommendations || []).map((job, i) => (
                            <div key={i} className="p-4 bg-slate-100 rounded-lg">
                                <h4 className="font-bold text-slate-800">{job.jobTitle}</h4>
                                <p className="text-sm text-slate-600 mt-1 mb-3">{job.reason}</p>
                                <div>
                                    <h5 className="text-xs font-bold text-slate-500 mb-2">매칭 스킬</h5>
                                    {(job.matchingSkills || []).map((skill, idx) => <SkillTag key={idx}>{skill}</SkillTag>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </ReportSection>
                <ReportSection icon={<SparklesIcon className="w-8 h-8 text-amber-500" />} title="종합 코칭"><p>{report.summary}</p></ReportSection>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <div className="flex-1 overflow-y-auto p-6 pb-32">
                
                {/* 1. Job Fit Dashboard (Top Section) */}
                {jobFitData && (
                    <div className="mb-8 border-b border-slate-200 pb-8">
                         <h2 className="text-xl font-bold text-slate-800 mb-4 px-2">직무 적합도 분석 (최근)</h2>
                        <JobFitAnalysisView data={jobFitData} />
                    </div>
                )}

                {/* 2. Comprehensive Report (Bottom Section) */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center text-center p-8">
                        <LoadingSpinner isWhite={false} />
                        <p className="mt-4 font-semibold text-indigo-600">AI가 리포트를 생성하고 있습니다...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-center">
                        <p className="font-bold">오류 발생</p><p>{error}</p>
                        <button onClick={handleGenerateReport} className="mt-4 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">재시도</button>
                    </div>
                )}

                {!isLoading && !error && !report && (
                    <div className="flex flex-col items-center justify-center text-center p-8">
                         <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-800">종합 리포트</h2>
                            <p className="text-slate-500 mt-2">나의 경험을 전체적으로 분석한 AI 리포트입니다.</p>
                        </div>
                        {experiences.length < 3 ? (
                            <><ChartPieIcon className="w-16 h-16 text-slate-400 mb-4" /><h3 className="text-xl font-semibold text-slate-700">경험이 더 필요해요</h3><p className="text-slate-500 mt-2">최소 3개 이상의 경험을 입력해주세요.</p></>
                        ) : (
                            <><ChartPieIcon className="w-16 h-16 text-indigo-400 mb-4" /><h3 className="text-xl font-semibold text-slate-700">준비되셨나요?</h3><button onClick={handleGenerateReport} className="mt-6 px-8 py-3 bg-indigo-500 text-white font-bold rounded-lg shadow-md hover:bg-indigo-600 transition-all transform hover:scale-105">종합 리포트 생성하기</button></>
                        )}
                    </div>
                )}
                
                {!isLoading && !error && report && renderReport()}
            </div>
            
            {/* Action Bar (Only for Report) */}
            {!isLoading && !error && report && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] animate-fade-in-up">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
                        {shareableLink ? (
                            <div className="p-2 bg-green-50 border border-green-200 rounded-lg w-full">
                                <div className="flex items-center gap-2">
                                    <input type="text" readOnly value={shareableLink} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-sm text-slate-900"/>
                                    <button onClick={copyLinkToClipboard} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 flex-shrink-0">
                                        <ClipboardIcon className="w-4 h-4" />
                                        {isLinkCopied ? '복사됨!' : '복사'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={handleShareReport} className="w-full sm:w-auto px-6 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                                <ShareIcon className="w-5 h-5"/>공유하기
                            </button>
                        )}
                        <button onClick={handleGenerateReport} className="w-full sm:w-auto px-6 py-3 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors">재생성</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ReportSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <section className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
        <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-slate-100 rounded-full">{icon}</div>
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        </div>
        <div className="text-slate-700 leading-relaxed">
            {children}
        </div>
    </section>
);

export default PersonalReportTab;
