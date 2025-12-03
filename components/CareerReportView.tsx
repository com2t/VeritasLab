
import React, { useState, useCallback, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Experience, ReportData, User, JobFitAnalysis, RadarMetric, GrowthPoint, KeywordMetric } from '../types';
import { db, addDoc, collection } from '../firebase';
import { LoadingSpinner, ChartPieIcon, ThumbUpIcon, ArrowTrendingUpIcon, AcademicCapIcon, SparklesIcon, ShareIcon, ClipboardIcon, BoxIcon, FolderIcon, ListBulletIcon, LightBulbIcon, PrinterIcon } from './icons';
import JobFitAnalysisView from './JobFitAnalysisView';

interface CareerReportViewProps {
    experiences: Experience[];
    user: User | null;
    report: ReportData | null;
    setReport: (report: ReportData | null) => void;
    jobFitData?: JobFitAnalysis | null;
    onShowDetail?: (id: string) => void;
}

// --- UPDATED SYSTEM INSTRUCTION FOR ADVANCED REPORT ---
const REPORT_SYSTEM_INSTRUCTION = `You are an expert career coach AI. Your task is to analyze a user's collection of experiences and generate a comprehensive, highly visual, and actionable career report JSON.

**CRITICAL LANGUAGE RULE**: ALL TEXT CONTENT (summaries, descriptions, reasons, methodologies, etc.) MUST BE IN **KOREAN (한국어)**.

The user's experiences are provided as a JSON array.
**Target Job Inference:** If the user has an 'interestedJob' in their profile, use it. If not, infer the most likely target job based on their experience patterns (e.g., if they have coding projects -> Software Engineer).

**CRITICAL RULES FOR ACCURACY:**
1. **NO HALLUCINATIONS:** Strictly adhere to facts found in the provided experiences.
2. **ZERO TOLERANCE FOR FAKE DATA:** If the user has NO experience or evidence for a specific skill or metric, **SET THE SCORE TO 0**. Do not guess, do not inflate numbers to make the chart look good. An empty chart is better than a lying chart.
3. **EVIDENCE BASED:** Only give high scores if there are concrete 'STAR' stories backing them up.

Structure your response to match this exact JSON schema:

{
  "keywordAnalysis": {
    "wordCloud": [
      { "text": "Keyword", "value": 85, "category": "interest" }
    ],
    "jobKeywords": [
      { "text": "JobSkill", "value": 90, "category": "job_related" }
    ]
  },
  "competencyRadar": {
    "targetJob": "Inferred Target Job Title (Korean)",
    "data": [
      { "axis": "Competency Name (Korean)", "myScore": 0, "avgScore": 5, "topScore": 10 }
    ]
  },
  "gapAnalysis": [
    {
      "skillName": "Missing Skill (Korean)",
      "gapDescription": "Why this gap matters (Korean)",
      "methodology": "Mindset or approach to learn this (Korean)",
      "recommendedActivity": "Specific activity type (e.g. Project) (Korean)"
    }
  ],
  "growthCurve": [
    { "year": "2021", "score": 20, "isProjection": false, "milestone": "Start", "description": "Started university club...", "relatedExperienceId": "optional_id_from_input" },
    { "year": "2025", "score": 90, "isProjection": true, "milestone": "Goal", "description": "Projected growth after internship..." }
  ],
  "swotAnalysis": {
    "strengths": ["S1", "S2"],
    "weaknesses": ["W1", "W2"],
    "opportunities": ["O1", "O2"],
    "threats": ["T1", "T2"],
    "industryTrends": "Detailed industry trend analysis (Korean)..."
  },
  "strengths": { "title": "핵심 강점", "content": "...", "examples": [], "skills": [] },
  "growthOpportunities": { "title": "성장 기회", "content": "...", "examples": [], "skills": [] },
  "jobRecommendations": [ { "jobTitle": "...", "reason": "...", "matchingSkills": [] } ],
  "summary": "Overall summary...",
  "experienceSummaries": [ { "title": "...", "summary": "..." } ],
  "storySummaries": [ { "title": "...", "summary": "..." } ],
  "consultantComments": []
}

**INSTRUCTIONS FOR SPECIFIC FIELDS:**

1.  **keywordAnalysis:**
    *   **wordCloud:** Extract 10-15 keywords representing the user's *personal interests* and *themes* found in their texts. 'value' (10-100) based on frequency/intensity.
    *   **jobKeywords:** Extract 5-10 keywords specifically related to *hard/soft skills* relevant to the target job.

2.  **competencyRadar (Activity Count Based):**
    *   Identify 5-6 key competencies required for the *Target Job*.
    *   **myScore (Activity Count):** **STRICTLY COUNT** the number of user experiences (from the input list) that demonstrate this specific competency. e.g., If they have 3 stories about 'Communication', score is 3. **DO NOT use 0-100 scale. Use Raw Counts.**
    *   **avgScore (Avg Activity Count):** Estimate the **Average Number of Experiences** a typical candidate for this job would have (e.g., usually 2-4).
    *   **topScore (Top Activity Count):** Estimate the **Number of Experiences** a TOP PERFORMER would have (e.g., usually 5-8+).

3.  **gapAnalysis:**
    *   Identify 2-3 areas where 'myScore' < 'topScore' (Activity Count Gap).
    *   **methodology:** Explain the *mindset* or *approach* needed to bridge this gap.
    *   **recommendedActivity:** Suggest a specific *category of experience* or project type to undertake.

4.  **growthCurve:**
    *   Analyze the timeline of experiences.
    *   Generate 3-4 historical data points (Year, Score). **Score** should be an **accumulated capability score** (0-100) showing their growth trajectory over time based strictly on the count and quality of experiences in that year. If no experiences in a year, flatline the score.
    *   Generate 2 future projection points (e.g., +1 year, +3 years) assuming they follow your advice.
    *   **milestone:** A short 2-3 word title for that year's status.
    *   **description:** A sentence explaining the reasoning for this score based on specific activities or lack thereof.
    *   **relatedExperienceId:** If this growth point is directly tied to a specific experience in the input list, include its 'id'.

5.  **swotAnalysis:**
    *   Standard SWOT based on user profile vs. Target Job Market.
    *   **industryTrends:** A brief paragraph describing current market situation (Crisis/Opportunity) for that job.
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

// --- Sub-component: Experience Matrix Table ---
const ExperienceMatrixTable: React.FC<{ experiences: Experience[] }> = ({ experiences }) => {
    const { matrix, sortedYears, sortedCategories } = useMemo(() => {
        const basicExperiences = experiences.filter(exp => exp.type === 'basic');
        const yearsSet = new Set<string>();
        const categoriesSet = new Set<string>();
        const tempMatrix: Record<string, Record<string, string[]>> = {};

        const extractYears = (dateStr: string | undefined): string[] => {
            if (!dateStr) return ['연도 미상'];
            const parts = dateStr.split(/~|-/);
            const startMatch = parts[0].match(/\d{4}/);
            if (!startMatch) return ['연도 미상'];
            const startYear = parseInt(startMatch[0], 10);
            if (parts.length === 1) return [startYear.toString()];
            let endYear = startYear;
            const endPart = parts[1].trim();
            if (endPart.includes('현재') || endPart.toLowerCase().includes('present') || endPart.toLowerCase().includes('now') || endPart.includes('진행중')) {
                endYear = new Date().getFullYear();
            } else {
                const endMatch = endPart.match(/\d{4}/);
                if (endMatch) endYear = parseInt(endMatch[0], 10);
            }
            const years: string[] = [];
            const safeStart = Math.min(startYear, endYear);
            const safeEnd = Math.max(startYear, endYear);
            for (let y = safeStart; y <= safeEnd; y++) years.push(y.toString());
            return years;
        };

        basicExperiences.forEach(exp => {
            const years = extractYears(exp.activity_date);
            const category = exp.activity_type || '기타';
            categoriesSet.add(category);
            years.forEach(year => {
                yearsSet.add(year);
                if (!tempMatrix[year]) tempMatrix[year] = {};
                if (!tempMatrix[year][category]) tempMatrix[year][category] = [];
                if (!tempMatrix[year][category].includes(exp.activity_name)) {
                    tempMatrix[year][category].push(exp.activity_name);
                }
            });
        });

        const sortedYears = Array.from(yearsSet).sort((a, b) => {
             if (a === '연도 미상') return 1;
             if (b === '연도 미상') return -1;
             return a.localeCompare(b);
        });

        const preferredOrder = ['수강과목', '동아리', '스터디', '자격증', '봉사활동', '프로젝트', '공모전', '대외활동', '인턴', '아르바이트', '기타활동'];
        const sortedCategories = Array.from(categoriesSet).sort((a, b) => {
            const idxA = preferredOrder.indexOf(a);
            const idxB = preferredOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        return { matrix: tempMatrix, sortedYears, sortedCategories };
    }, [experiences]);

    return (
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm table-fixed">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 border-r border-slate-200 w-24 z-10">연도</th>
                        {sortedCategories.map(cat => (
                            <th key={cat} className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider min-w-[160px] w-auto">{cat}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {sortedYears.map((year, idx) => (
                        <tr key={year} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                            <td className="px-4 py-3 font-bold text-indigo-600 border-r border-slate-200 sticky left-0 bg-inherit whitespace-nowrap align-top z-10">{year}년</td>
                            {sortedCategories.map(cat => {
                                const items = matrix[year]?.[cat] || [];
                                return (
                                    <td key={`${year}-${cat}`} className="px-4 py-3 align-top">
                                        {items.length > 0 ? (
                                            <div className="flex flex-col gap-1.5">
                                                {items.map((name, i) => (
                                                    <span key={i} className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-200 whitespace-normal break-words leading-snug w-full h-auto">{name}</span>
                                                ))}
                                            </div>
                                        ) : <span className="text-slate-300 text-xs">-</span>}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const StorySummaryTable: React.FC<{ experiences: Experience[]; onShowDetail?: (id: string) => void }> = ({ experiences, onShowDetail }) => {
    const stories = useMemo(() => {
        return experiences
            .filter(exp => exp.type === 'story')
            .sort((a, b) => (b.activity_date || '').localeCompare(a.activity_date || ''));
    }, [experiences]);

    if (stories.length === 0) return <div className="p-4 text-center text-slate-500 italic">생성된 스토리가 없습니다.</div>;

    return (
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-4 py-3 text-center font-bold text-slate-500 uppercase tracking-wider w-16">순번</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider min-w-[150px]">스토리명</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider min-w-[300px]">스토리 요약 (STAR)</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider min-w-[150px]">관련 활동</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {stories.map((story, idx) => (
                        <tr key={story.id} className={`transition-colors ${onShowDetail ? 'hover:bg-indigo-50/50 cursor-pointer' : 'hover:bg-slate-50'}`} onClick={() => onShowDetail?.(story.id)}>
                            <td className="px-4 py-4 text-center font-medium text-slate-500 align-top">{idx + 1}</td>
                            <td className="px-4 py-4 font-bold text-slate-800 align-top group">
                                {story.story_title}
                                <div className="text-xs text-slate-400 font-normal mt-1">{story.activity_date}</div>
                            </td>
                            <td className="px-4 py-4 text-slate-600 align-top leading-relaxed whitespace-pre-wrap">{story.story_summary}</td>
                            <td className="px-4 py-4 align-top">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                    <FolderIcon className="w-3 h-3" />
                                    {story.activity_name}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const WordCloudSection: React.FC<{ keywords: KeywordMetric[] }> = ({ keywords }) => (
    <div className="flex flex-wrap gap-3 items-center justify-center p-6 bg-slate-50 rounded-xl min-h-[150px]">
        {keywords.map((k, i) => {
            const fontSize = Math.max(0.8, Math.min(2.0, k.value / 30)) + 'rem';
            const opacity = Math.max(0.6, Math.min(1, k.value / 100));
            return (
                <span key={i} style={{ fontSize, opacity }} className={`font-bold transition-all hover:scale-110 cursor-default ${k.category === 'job_related' ? 'text-indigo-600' : 'text-slate-600'}`}>{k.text}</span>
            );
        })}
    </div>
);

const ReportRadarChart: React.FC<{ data: RadarMetric[], targetJob: string }> = ({ data, targetJob }) => {
    const size = 300; 
    const center = size / 2; 
    const radius = size / 2 - 40; 
    
    // Calculate dynamic max score based on activity counts
    const maxValue = Math.max(...data.map(d => Math.max(d.myScore, d.avgScore, d.topScore)));
    // Ensure a minimum scale (e.g., 5) so small counts don't look huge, and handle 0 case.
    const maxScore = maxValue > 0 ? Math.ceil(maxValue * 1.1) : 5; // Add 10% buffer

    const calculatePoints = (scores: number[]) => {
        const total = data.length;
        return data.map((_, i) => {
            const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
            const value = scores[i] || 0;
            const x = center + (radius * (value / maxScore)) * Math.cos(angle);
            const y = center + (radius * (value / maxScore)) * Math.sin(angle);
            return `${x},${y}`;
        }).join(' ');
    };
    
    const myPoints = calculatePoints(data.map(d => d.myScore));
    const avgPoints = calculatePoints(data.map(d => d.avgScore));
    const topPoints = calculatePoints(data.map(d => d.topScore));
    const bgPoints = calculatePoints(new Array(data.length).fill(maxScore));

    return (
        <div className="flex flex-col items-center">
            <h4 className="text-lg font-bold text-slate-800 mb-2">{targetJob} 역량 비교 (활동 수 기준)</h4>
            <div className="relative">
                <svg width={size} height={size}>
                     {/* Background Polygon (Max) */}
                     <polygon points={bgPoints} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
                     
                     {/* Grid Lines (25%, 50%, 75% of dynamic max) */}
                     {[0.25, 0.5, 0.75].map(scale => (
                        <polygon key={scale} points={calculatePoints(new Array(data.length).fill(maxScore * scale))} fill="none" stroke="#e2e8f0" strokeDasharray="4 4" />
                     ))}
                    
                    {/* Top Performer (Count) */}
                    <polygon points={topPoints} fill="rgba(251, 191, 36, 0.1)" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 5"/>
                    
                    {/* Avg (Count) */}
                    <polygon points={avgPoints} fill="rgba(100, 116, 139, 0.2)" stroke="#64748b" strokeWidth="2" strokeDasharray="2 2" />
                    
                    {/* My Score (Count) */}
                    <polygon points={myPoints} fill="rgba(79, 70, 229, 0.4)" stroke="#4f46e5" strokeWidth="2" />
                    
                     {data.map((d, i) => {
                        const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
                        const x = center + (radius + 20) * Math.cos(angle);
                        const y = center + (radius + 20) * Math.sin(angle);
                        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="text-xs font-semibold fill-slate-600">{d.axis}</text>;
                    })}
                </svg>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs font-semibold">
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-500 opacity-60 rounded-full"></div><span className="text-indigo-700">나 (My Activities)</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-500 opacity-60 rounded-full"></div><span className="text-slate-600">업계 평균</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-400 opacity-60 rounded-full"></div><span className="text-amber-600">Top Performer</span></div>
            </div>
        </div>
    );
};

const GrowthLineChart: React.FC<{ points: GrowthPoint[], onShowDetail?: (id: string) => void }> = ({ points, onShowDetail }) => {
    const [activePoint, setActivePoint] = useState<GrowthPoint | null>(null);
    const height = 200; const width = 500; const padding = 40;
    const sortedPoints = useMemo(() => [...points].sort((a, b) => parseInt(a.year) - parseInt(b.year)), [points]);
    const getX = (index: number) => { const count = sortedPoints.length; if (count <= 1) return width / 2; return padding + (index / (count - 1)) * (width - padding * 2); };
    const getY = (score: number) => height - padding - (score / 100) * (height - padding * 2);
    const projectionStartIndex = sortedPoints.findIndex(p => p.isProjection);
    let historicalPathD = ""; const lastHistoricalIndex = projectionStartIndex === -1 ? sortedPoints.length - 1 : projectionStartIndex - 1;
    if (sortedPoints.length > 0) { historicalPathD = `M ${getX(0)} ${getY(sortedPoints[0].score)}`; for (let i = 1; i <= lastHistoricalIndex; i++) { historicalPathD += ` L ${getX(i)} ${getY(sortedPoints[i].score)}`; } }
    let projectionPathD = ""; if (projectionStartIndex > 0) { const startIndex = projectionStartIndex - 1; projectionPathD = `M ${getX(startIndex)} ${getY(sortedPoints[startIndex].score)}`; for (let i = startIndex + 1; i < sortedPoints.length; i++) { projectionPathD += ` L ${getX(i)} ${getY(sortedPoints[i].score)}`; } } else if (projectionStartIndex === 0) { projectionPathD = `M ${getX(0)} ${getY(sortedPoints[0].score)}`; for (let i = 1; i < sortedPoints.length; i++) { projectionPathD += ` L ${getX(i)} ${getY(sortedPoints[i].score)}`; } }

    return (
        <div className="w-full overflow-x-auto relative group">
             <div className="min-w-[400px] relative">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                    {[0, 25, 50, 75, 100].map(val => <line key={val} x1={padding} y1={getY(val)} x2={width - padding} y2={getY(val)} stroke="#f1f5f9" strokeWidth="1" />)}
                    {historicalPathD && <path d={historicalPathD} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />}
                    {projectionPathD && <path d={projectionPathD} fill="none" stroke="#818cf8" strokeWidth="4" strokeDasharray="6 6" strokeLinecap="round" className="opacity-70" />}
                    {sortedPoints.map((p, i) => {
                        const cx = getX(i); const cy = getY(p.score); const isActive = activePoint === p;
                        return (
                            <g key={i} className="cursor-pointer group/dot" onMouseEnter={() => setActivePoint(p)} onMouseLeave={() => setActivePoint(null)} onClick={() => setActivePoint(p === activePoint ? null : p)}>
                                <circle cx={cx} cy={cy} r={20} fill="transparent" />
                                <circle cx={cx} cy={cy} r={isActive ? 12 : 0} className="fill-indigo-100 transition-all duration-300" />
                                <circle cx={cx} cy={cy} r={isActive ? 7 : (p.isProjection ? 5 : 6)} fill={p.isProjection ? "#fff" : "#6366f1"} stroke={p.isProjection ? "#6366f1" : "#fff"} strokeWidth={p.isProjection ? "3" : "2"} className="transition-all duration-300 shadow-sm" />
                                <text x={cx} y={height - 10} textAnchor="middle" fontSize="14" fill={isActive ? "#4f46e5" : "#64748b"} fontWeight={isActive ? "bold" : "500"} className="transition-colors">{p.year}</text>
                                {isActive && <text x={cx} y={cy - 15} textAnchor="middle" fontSize="12" fill="#4f46e5" fontWeight="bold" className="animate-fade-in-up">{p.score}</text>}
                            </g>
                        );
                    })}
                </svg>
                {activePoint && (() => {
                    const index = sortedPoints.indexOf(activePoint); const isFirst = index === 0; const isLast = index === sortedPoints.length - 1;
                    let leftPos = `${(getX(index) / width) * 100}%`; let translateXClass = "-translate-x-1/2";
                    if (isFirst) { translateXClass = "-translate-x-0"; } else if (isLast) { translateXClass = "-translate-x-full"; }
                    return (
                        <div className={`absolute z-20 bg-white p-4 rounded-xl shadow-xl border border-slate-100 w-60 transform transition-all animate-fade-in-up ${translateXClass}`} style={{ left: leftPos, top: `${(getY(activePoint.score) / height) * 100}%`, marginTop: '20px' }}>
                            <div className={`absolute -top-2 w-4 h-4 bg-white border-t border-l border-slate-100 transform rotate-45 ${isFirst ? 'left-4' : isLast ? 'right-4' : 'left-1/2 -translate-x-1/2'}`}></div>
                            <div className="relative z-10">
                                <h5 className="font-bold text-slate-800 text-base mb-1.5 flex items-center justify-between"><span>{activePoint.milestone || `${activePoint.year}년`}</span>{activePoint.isProjection && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Future</span>}</h5>
                                <div className="w-full h-px bg-slate-100 mb-2"></div>
                                <p className="text-sm text-slate-600 leading-snug">{activePoint.description || "상세 내용 없음"}</p>
                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">점수: {activePoint.score}</span>
                                    {activePoint.relatedExperienceId && onShowDetail && <button onClick={(e) => { e.stopPropagation(); onShowDetail(activePoint.relatedExperienceId!); }} className="text-xs font-bold text-slate-500 hover:text-indigo-600 hover:underline flex items-center gap-0.5 pointer-events-auto">상세 보기 &gt;</button>}
                                </div>
                            </div>
                        </div>
                    );
                })()}
             </div>
             <p className="text-center text-xs text-slate-400 mt-4">* 점을 누르면 상세 내용을 확인할 수 있습니다.</p>
        </div>
    );
};

const SWOTGrid: React.FC<{ data: any }> = ({ data }) => (
    <div className="space-y-6">
        <div className="bg-slate-800 text-white p-4 rounded-lg shadow-md">
            <h4 className="font-bold mb-2 flex items-center gap-2"><ArrowTrendingUpIcon className="w-5 h-5 text-green-400" />업계 현황 (Industry Trends)</h4>
            <p className="text-sm opacity-90 leading-relaxed">{data.industryTrends}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100"><h4 className="font-bold text-blue-800 mb-2">Strengths (강점)</h4><ul className="list-disc list-inside text-sm text-blue-700 space-y-1">{data.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100"><h4 className="font-bold text-red-800 mb-2">Weaknesses (약점)</h4><ul className="list-disc list-inside text-sm text-red-700 space-y-1">{data.weaknesses.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-100"><h4 className="font-bold text-green-800 mb-2">Opportunities (기회)</h4><ul className="list-disc list-inside text-sm text-green-700 space-y-1">{data.opportunities.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100"><h4 className="font-bold text-orange-800 mb-2">Threats (위협)</h4><ul className="list-disc list-inside text-sm text-orange-700 space-y-1">{data.threats.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>
        </div>
    </div>
);

const GapAnalysisCard: React.FC<{ action: any }> = ({ action }) => (
    <div className="bg-white p-4 rounded-xl border-l-4 border-indigo-500 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start"><h4 className="font-bold text-slate-800">{action.skillName}</h4><span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Gap 보완</span></div>
        <p className="text-sm text-slate-600 mt-1 mb-3">{action.gapDescription}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="bg-slate-50 p-3 rounded-lg"><p className="text-xs font-bold text-slate-500 uppercase mb-1">Methodology (How)</p><p className="text-sm text-slate-800 font-medium">{action.methodology}</p></div>
            <div className="bg-indigo-50 p-3 rounded-lg"><p className="text-xs font-bold text-indigo-500 uppercase mb-1">Action (What)</p><p className="text-sm text-indigo-800 font-medium">{action.recommendedActivity}</p></div>
        </div>
    </div>
);

const CareerReportView: React.FC<CareerReportViewProps> = ({ experiences, user, report, setReport, jobFitData, onShowDetail }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shareableLink, setShareableLink] = useState<string | null>(null);
    const [isLinkCopied, setIsLinkCopied] = useState(false);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    const storyCount = useMemo(() => {
        return experiences.filter(e => e.type === 'story').length;
    }, [experiences]);

    const handleGenerateReport = useCallback(async () => {
        if (storyCount < 3) {
            setError("리포트를 생성하기에는 스토리가 부족합니다.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setReport(null);
        setShareableLink(null);

        try {
            // Sort experiences deterministically to ensure consistent input
            const sortedExperiences = [...experiences].sort((a, b) => a.id.localeCompare(b.id));

            const cleanExperiences = sortedExperiences.map(exp => ({
                id: exp.id,
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
            const userJob = user && 'interestedJob' in user ? (user as any).interestedJob : '';
            const prompt = `User Interested Job: ${userJob || 'Unknown'}\n\nHere are my experiences (Count of STAR Stories: ${storyCount}):\n${experiencesString}`;
            
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: REPORT_SYSTEM_INSTRUCTION,
                    responseMimeType: "application/json",
                    temperature: 0, // Deterministic generation
                    seed: 42,       // Fixed seed for consistency
                    thinkingConfig: { thinkingBudget: 1024 }
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
    }, [experiences, ai.models, setReport, storyCount, user]);

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

    const handlePrint = () => {
        window.print();
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
            <div className="space-y-8 animate-fade-in-up">
                <div className="text-center mb-8 pt-4">
                    <h2 className="text-2xl font-bold text-slate-800">종합 커리어 리포트</h2>
                    <p className="text-slate-500 mt-2">AI가 분석한 나의 커리어 경쟁력 및 성장 로드맵</p>
                </div>

                <ReportSection icon={<SparklesIcon className="w-8 h-8 text-indigo-500" />} title="관심사 & 직무 키워드 분석">
                    <div className="space-y-6">
                        <div><h4 className="text-sm font-bold text-slate-500 uppercase mb-2">나의 관심사 (Text Mining)</h4><WordCloudSection keywords={report.keywordAnalysis?.wordCloud || []} /></div>
                        <div><h4 className="text-sm font-bold text-slate-500 uppercase mb-2">직무 연관 키워드</h4><div className="flex flex-wrap gap-2">{(report.keywordAnalysis?.jobKeywords || []).map((k, i) => (<div key={i} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"><span className="font-bold text-indigo-700">{k.text}</span><div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${k.value}%` }}></div></div></div>))}</div></div>
                    </div>
                </ReportSection>

                <div className="flex flex-col gap-6">
                    <ReportSection icon={<ArrowTrendingUpIcon className="w-8 h-8 text-blue-500" />} title="역량 비교 분석">
                        {report.competencyRadar && <ReportRadarChart data={report.competencyRadar.data} targetJob={report.competencyRadar.targetJob} />}
                    </ReportSection>
                    <ReportSection icon={<LightBulbIcon className="w-8 h-8 text-amber-500" />} title="Gap 보완 가이드">
                         <div className="space-y-4">{(report.gapAnalysis || []).map((action, i) => <GapAnalysisCard key={i} action={action} />)}{(report.gapAnalysis?.length === 0) && <p className="text-slate-500">보완할 주요 Gap이 감지되지 않았습니다.</p>}</div>
                    </ReportSection>
                </div>

                <ReportSection icon={<ChartPieIcon className="w-8 h-8 text-purple-500" />} title="성장 그래프 (과거 및 예측)">
                    <div className="p-4 bg-white rounded-xl">{report.growthCurve && <GrowthLineChart points={report.growthCurve} onShowDetail={onShowDetail} />}</div>
                </ReportSection>

                <ReportSection icon={<ClipboardIcon className="w-8 h-8 text-slate-700" />} title="SWOT & 업계 현황">
                    {report.swotAnalysis && <SWOTGrid data={report.swotAnalysis} />}
                </ReportSection>
                
                <div className="flex flex-col gap-6">
                    <ReportSection icon={<ThumbUpIcon className="w-8 h-8 text-green-500" />} title={report.strengths?.title || '핵심 강점'}>
                        <div className="mb-4">{(report.strengths?.skills || []).map((skill, idx) => <SkillTag key={idx}>{skill}</SkillTag>)}</div>
                        <p className="mb-4 text-sm">{report.strengths?.content}</p>
                    </ReportSection>
                    <ReportSection icon={<ArrowTrendingUpIcon className="w-8 h-8 text-blue-500" />} title={report.growthOpportunities?.title || '성장 기회'}>
                        <div className="mb-4">{(report.growthOpportunities?.skills || []).map((skill, idx) => <SkillTag key={idx}>{skill}</SkillTag>)}</div>
                        <p className="mb-4 text-sm">{report.growthOpportunities?.content}</p>
                    </ReportSection>
                </div>

                <ReportSection icon={<AcademicCapIcon className="w-8 h-8 text-indigo-500" />} title="추천 직무 상세">
                    <div className="space-y-4">
                        {(report.jobRecommendations || []).map((job, i) => (
                            <div key={i} className="p-4 bg-slate-100 rounded-lg">
                                <h4 className="font-bold text-slate-800">{job.jobTitle}</h4>
                                <p className="text-sm text-slate-600 mt-1 mb-3">{job.reason}</p>
                                <div><h5 className="text-xs font-bold text-slate-500 mb-2">매칭 스킬</h5>{(job.matchingSkills || []).map((skill, idx) => <SkillTag key={idx}>{skill}</SkillTag>)}</div>
                            </div>
                        ))}
                    </div>
                </ReportSection>
                <ReportSection icon={<SparklesIcon className="w-8 h-8 text-amber-500" />} title="종합 코칭"><p>{report.summary}</p></ReportSection>

                <div className="pt-8 border-t border-slate-200">
                    <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-slate-100 rounded-full"><ListBulletIcon className="w-6 h-6 text-slate-600" /></div><h3 className="text-xl font-bold text-slate-800">연도별 경험 매트릭스</h3></div>
                    <ExperienceMatrixTable experiences={experiences} />
                </div>

                <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-slate-100 rounded-full"><BoxIcon className="w-6 h-6 text-indigo-600" /></div><h3 className="text-xl font-bold text-slate-800">스토리 요약 (STAR)</h3></div>
                    <StorySummaryTable experiences={experiences} onShowDetail={onShowDetail} />
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <div className="flex-1 overflow-y-auto p-6 pb-32">
                <div id="printable-report-area">
                    {jobFitData && (
                        <div className="mb-8 border-b border-slate-200 pb-8 break-inside-avoid page-break-inside-avoid">
                             <h2 className="text-xl font-bold text-slate-800 mb-4 px-2">직무 적합도 분석 (최근)</h2>
                            <JobFitAnalysisView data={jobFitData} />
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8 h-full">
                            <LoadingSpinner isWhite={false} />
                            <p className="mt-4 font-semibold text-indigo-600">AI가 데이터를 분석하여 리포트를 생성하고 있습니다...</p>
                            <p className="text-xs text-slate-400 mt-2">약 10-20초 정도 소요될 수 있습니다.</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-center">
                            <p className="font-bold">오류 발생</p><p>{error}</p>
                            {storyCount >= 3 && (
                                <button onClick={handleGenerateReport} className="mt-4 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors">재시도</button>
                            )}
                        </div>
                    )}

                    {!isLoading && !error && !report && (
                        <div className="flex flex-col items-center justify-center text-center p-8 h-full">
                             <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-slate-800">종합 리포트</h2>
                                <p className="text-slate-500 mt-2">나의 경험을 전체적으로 분석한 AI 리포트입니다.</p>
                            </div>
                            
                            {storyCount < 3 ? (
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full">
                                    <BoxIcon className="w-16 h-16 text-indigo-200 mx-auto mb-4" />
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">스토리가 더 필요해요!</h3>
                                    <p className="text-slate-600 mb-6">
                                        정확한 역량 분석을 위해<br/>
                                        <strong>최소 3개 이상의 스토리</strong>가 필요합니다.<br/>
                                        <span className="text-sm text-slate-500 mt-1 block">(현재: {storyCount}개)</span>
                                    </p>
                                    <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg mb-2 text-left">
                                        <strong>💡 팁:</strong> 채팅창에서 대화를 나누며 "스토리로 정리해줘"라고 요청하면 쉽게 스토리를 만들 수 있습니다.
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full">
                                    <ChartPieIcon className="w-16 h-16 text-indigo-500 mx-auto mb-4 animate-pulse" />
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">분석 준비 완료!</h3>
                                    <p className="text-slate-600 mb-6">
                                        {storyCount}개의 스토리를 바탕으로<br/>나만의 커리어 리포트를 생성할 수 있습니다.
                                    </p>
                                    <button onClick={handleGenerateReport} className="w-full px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105 hover:shadow-xl">
                                        종합 리포트 생성하기 ✨
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {!isLoading && !error && report && renderReport()}
                </div>
            </div>
            
            {!isLoading && !error && report && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] animate-fade-in-up z-20">
                    <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button onClick={handlePrint} className="w-full sm:w-auto px-6 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"><PrinterIcon className="w-5 h-5"/> PDF 저장 (인쇄)</button>
                        {shareableLink ? (
                            <div className="p-2 bg-green-50 border border-green-200 rounded-lg w-full">
                                <div className="flex items-center gap-2">
                                    <input type="text" readOnly value={shareableLink} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 text-sm text-slate-900"/>
                                    <button onClick={copyLinkToClipboard} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 flex-shrink-0"><ClipboardIcon className="w-4 h-4" />{isLinkCopied ? '복사됨!' : '복사'}</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={handleShareReport} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"><ShareIcon className="w-5 h-5"/> 링크로 공유</button>
                        )}
                        <button onClick={handleGenerateReport} className="w-full sm:w-auto px-6 py-3 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors">재생성</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ReportSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <section className="bg-white p-6 rounded-xl shadow-md border border-slate-200 break-inside-avoid page-break-inside-avoid">
        <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-slate-100 rounded-full">{icon}</div>
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        </div>
        <div className="text-slate-700 leading-relaxed">
            {children}
        </div>
    </section>
);

export default CareerReportView;
