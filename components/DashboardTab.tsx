
import React, { useMemo, useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Experience, JobRecommendation } from '../types';
import { CalendarIcon, LightBulbIcon, BriefcaseIcon, ChartBarIcon, SparklesIcon, LoadingSpinner, LinkIcon } from './icons';

interface DashboardTabProps {
    experiences: Experience[];
    onShowDetail: (id: string) => void;
}

const DashboardSection: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
            {icon}
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        </div>
        {children}
    </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center py-8 text-slate-500">
        <p>{message}</p>
    </div>
);

const DashboardTab: React.FC<DashboardTabProps> = ({ experiences, onShowDetail }) => {
    const [recommendations, setRecommendations] = useState<JobRecommendation[] | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [recommendationCitations, setRecommendationCitations] = useState<{ web: { uri: string; title: string } }[] | null>(null);


    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const {
        sortedYears,
        experiencesByYear,
        timelineHasData
    } = useMemo(() => {
        const timelineExperiences = experiences
            .filter(exp => exp.type === 'basic' && exp.activity_date)
            .map(exp => ({...exp, sortDate: new Date(exp.activity_date.split('~')[0].trim())}))
            .filter(exp => !isNaN(exp.sortDate.getTime()))
            .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

        const experiencesByYear = timelineExperiences.reduce((acc, exp) => {
            const year = exp.sortDate.getFullYear();
            if (!acc[year]) {
                acc[year] = [];
            }
            acc[year].push(exp);
            return acc;
        }, {} as Record<number, Experience[]>);

        const sortedYears = Object.keys(experiencesByYear).map(Number).sort((a, b) => a - b);
        return { sortedYears, experiencesByYear, timelineHasData: timelineExperiences.length > 0 };
    }, [experiences]);
    
    const {
        sortedCompetencies,
        maxCompetencyCount,
        sortedJobs,
        maxJobCount
    } = useMemo(() => {
        const storyExperiences = experiences.filter(exp => exp.type === 'story');
        
        // FIX: Explicitly type accumulator and filter to ensure Record<string, number> result
        const competencyCounts: Record<string, number> = storyExperiences
            .flatMap(exp => (exp.core_competency || '').split(',').map(c => c.trim()))
            .filter((c): c is string => !!c)
            .reduce((acc, competency) => {
                acc[competency] = (acc[competency] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        // FIX: Explicitly type accumulator and filter to ensure Record<string, number> result
        const jobCounts: Record<string, number> = storyExperiences
            .flatMap(exp => (exp.job_alignment || '').split(',').map(j => j.trim()))
            .filter((j): j is string => !!j)
            .reduce((acc, job) => {
                acc[job] = (acc[job] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
        
        return {
            sortedCompetencies: Object.entries(competencyCounts).sort(([, a], [, b]) => b - a),
            maxCompetencyCount: Math.max(...Object.values(competencyCounts), 1),
            sortedJobs: Object.entries(jobCounts).sort(([, a], [, b]) => b - a),
            maxJobCount: Math.max(...Object.values(jobCounts), 1),
        };
    }, [experiences]);

    const getTagStyle = (count: number, maxCount: number) => {
        const minFontSize = 0.875; // rem (text-sm)
        const maxFontSize = 2.25;  // rem (text-4xl)
        const minOpacity = 0.6;
        const maxOpacity = 1.0;

        if (maxCount <= 1) {
            return { fontSize: `${minFontSize}rem`, opacity: maxOpacity };
        }
        
        const scale = (count - 1) / (maxCount - 1);
        const fontSize = minFontSize + (maxFontSize - minFontSize) * scale;
        const opacity = minOpacity + (maxOpacity - minOpacity) * scale;

        return { fontSize: `${fontSize}rem`, opacity };
    };
    
    const handleGenerateRecommendations = async () => {
        setIsGenerating(true);
        setGenerationError(null);
        setRecommendations(null);
        setRecommendationCitations(null);

        const competencies = sortedCompetencies.map(([comp]) => comp).join(', ');
        const storySummaries = experiences
            .filter(exp => exp.type === 'story')
            .map(exp => `- ${exp.story_title}: ${exp.story_summary}`)
            .join('\n');

        const prompt = `
            Based on the user's core competencies and experience summaries provided below, act as an expert career counselor.
            Use your search capabilities to research current job market trends, required skills for various roles, and future outlooks.
            Then, recommend three specific job roles that are an excellent fit for this user.
            For each recommendation, provide a detailed reason explaining the match and list the user's relevant skills.

            ## User's Core Competencies
            ${competencies || 'No specific competencies identified yet.'}

            ## User's Experience Summaries
            ${storySummaries || 'No specific stories provided yet.'}
        `;

        try {
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    tools: [{googleSearch: {}}],
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                jobTitle: { type: Type.STRING, description: 'Recommended job title (e.g., Product Manager)' },
                                reason: { type: Type.STRING, description: 'A detailed reason why this job is recommended based on the user\'s skills and current market trends.' },
                                matchingSkills: {
                                    type: Type.ARRAY,
                                    items: { type: Type.STRING },
                                    description: 'A list of the user\'s skills that align with this job.'
                                }
                            },
                            required: ["jobTitle", "reason", "matchingSkills"]
                        }
                    }
                }
            });

            const data = JSON.parse(result.text) as JobRecommendation[];
            setRecommendations(data);

            const citations = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (citations) {
                const webCitations = citations.filter(c => c.web && c.web.uri && c.web.title) as { web: { uri: string; title: string } }[];
                setRecommendationCitations(webCitations.length > 0 ? webCitations : null);
            }

        } catch (error) {
            console.error("Failed to generate recommendations:", error);
            setGenerationError("추천 직무를 생성하는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    if (experiences.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 bg-slate-50">
                <ChartBarIcon className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg font-semibold">데이터가 부족하여 분석을 표시할 수 없습니다.</p>
                <p className="text-sm mt-1">경험을 추가하고 다시 확인해주세요.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-6 sm:space-y-8 animate-fade-in">
            <DashboardSection title="경험 타임라인" icon={<CalendarIcon className="w-6 h-6 text-indigo-500" />}>
                {timelineHasData ? (
                    <div className="relative pl-6 py-2">
                        {/* The main vertical line */}
                        <div className="absolute left-[9px] top-5 bottom-5 w-0.5 bg-slate-200"></div>
                        {sortedYears.map((year) => (
                            <div key={year} className="relative mb-8">
                                <div className="flex items-center mb-4">
                                    <div className="absolute -left-[37px] z-10 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-sm ring-8 ring-white">
                                        {String(year).slice(-2)}
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-700 ml-4">{year}</h3>
                                </div>
                                <div className="space-y-6">
                                    {experiencesByYear[year].map(exp => (
                                        <div key={exp.id} className="relative flex items-start">
                                            <div className="absolute left-[-21px] top-4 w-3 h-3 bg-white rounded-full border-2 border-indigo-500 z-10"></div>
                                            <div 
                                                onClick={() => onShowDetail(exp.id)}
                                                className="ml-4 w-full bg-slate-100 p-4 rounded-lg hover:bg-indigo-100 hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-indigo-200"
                                            >
                                                <p className="font-semibold text-slate-800">{exp.activity_name}</p>
                                                <p className="text-sm text-slate-500 mt-1">{exp.activity_date}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <EmptyState message="타임라인을 표시할 기본 경험 데이터가 없습니다." />}
            </DashboardSection>

            <DashboardSection title="핵심 역량" icon={<LightBulbIcon className="w-6 h-6 text-amber-500" />}>
                <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-center p-4 min-h-[10rem]">
                    {sortedCompetencies.length > 0 ? sortedCompetencies.map(([competency, count]) => (
                        <span 
                            key={competency} 
                            style={getTagStyle(count, maxCompetencyCount)}
                            className="font-bold text-amber-600 transition-all"
                            title={`${count}회 언급`}
                        >
                            {competency}
                        </span>
                    )) : <EmptyState message="역량을 분석할 스토리 데이터가 없습니다." />}
                </div>
            </DashboardSection>

            <DashboardSection title="관련 직무" icon={<BriefcaseIcon className="w-6 h-6 text-sky-500" />}>
                <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-center p-4 min-h-[10rem]">
                    {sortedJobs.length > 0 ? sortedJobs.map(([job, count]) => (
                        <span 
                            key={job} 
                            style={getTagStyle(count, maxJobCount)}
                            className="font-bold text-sky-600 transition-all"
                             title={`${count}회 언급`}
                        >
                            {job}
                        </span>
                    )) : <EmptyState message="직무를 분석할 스토리 데이터가 없습니다." />}
                </div>
            </DashboardSection>

            <DashboardSection title="AI 추천 직무" icon={<SparklesIcon className="w-6 h-6 text-purple-500" />}>
                {isGenerating ? (
                    <div className="flex flex-col items-center justify-center text-center p-8">
                        <LoadingSpinner isWhite={false} />
                        <p className="mt-4 font-semibold text-indigo-600">AI가 추천 직무를 분석 중입니다...</p>
                    </div>
                ) : generationError ? (
                    <div className="text-center py-8 text-red-500">
                        <p>{generationError}</p>
                        <button onClick={handleGenerateRecommendations} className="mt-4 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">재시도</button>
                    </div>
                ) : recommendations ? (
                    <div>
                        <div className="space-y-4">
                            {recommendations.map((rec, index) => (
                                <div key={index} className="bg-slate-100 p-4 rounded-lg border border-slate-200">
                                    <h3 className="font-bold text-lg text-slate-800">{rec.jobTitle}</h3>
                                    <p className="text-sm text-slate-600 mt-1 mb-3">{rec.reason}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {rec.matchingSkills.map(skill => (
                                            <span key={skill} className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-full">{skill}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {recommendationCitations && recommendationCitations.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-slate-200">
                                <h4 className="text-sm font-bold text-slate-600 mb-3 flex items-center gap-2">
                                    <LinkIcon className="w-4 h-4" />
                                    Powered by Google Search
                                </h4>
                                <ul className="space-y-1">
                                    {recommendationCitations.map((citation, index) => (
                                        <li key={index} className="text-xs">
                                            <a 
                                                href={citation.web.uri} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="text-blue-600 hover:underline truncate"
                                                title={citation.web.title}
                                            >
                                                {citation.web.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="text-center mt-6">
                            <button onClick={handleGenerateRecommendations} className="text-sm font-semibold text-slate-500 hover:text-slate-700">다시 추천받기</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-slate-600 mb-4">AI가 당신의 경험을 분석하여 맞춤 직무를 추천해 드립니다.</p>
                        <button 
                            onClick={handleGenerateRecommendations} 
                            className="px-6 py-2 bg-indigo-500 text-white font-bold rounded-lg shadow-sm hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={sortedCompetencies.length === 0}
                        >
                            {sortedCompetencies.length === 0 ? '분석할 스토리 데이터 부족' : '추천 받기'}
                        </button>
                    </div>
                )}
            </DashboardSection>
        </div>
    );
};

export default DashboardTab;
