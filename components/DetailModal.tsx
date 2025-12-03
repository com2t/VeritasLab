
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Experience } from '../types';
import { TrashIcon, StarIcon, PencilSquareIcon, CheckIcon, XCircleIcon, SparklesIcon, LoadingSpinner, ChevronDownIcon } from './icons';
import { ALLOWED_CATEGORIES } from '../constants';

interface DetailModalProps {
    experience: Experience;
    experiences: Experience[];
    isOpen: boolean;
    onClose: () => void;
    onDelete: (id: string) => void;
    onNavigateToStory: (storyId: string) => void;
    onUpdate: (id: string, updates: Partial<Experience>) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ experience, experiences, isOpen, onClose, onDelete, onNavigateToStory, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(experience.activity_name);
    const [editDate, setEditDate] = useState(experience.activity_date);
    const [editType, setEditType] = useState(experience.activity_type || '기타');
    const [editStoryTitle, setEditStoryTitle] = useState(experience.story_title || '');
    
    // Suggestion State
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        setEditName(experience.activity_name);
        setEditDate(experience.activity_date);
        setEditType(experience.activity_type || '기타');
        setEditStoryTitle(experience.story_title || '');
        setIsEditing(false);
    }, [experience]);

    // Extract unique activity names for autocomplete
    const uniqueActivityNames = useMemo(() => {
        const names = experiences.map(e => e.activity_name).filter(Boolean);
        return Array.from(new Set(names)).sort();
    }, [experiences]);

    // Filter suggestions
    const filteredSuggestions = useMemo(() => {
        if (!editName) return uniqueActivityNames;
        return uniqueActivityNames.filter(name => 
            name.toLowerCase().includes(editName.toLowerCase())
        );
    }, [uniqueActivityNames, editName]);

    if (!isOpen) return null;

    const isStory = experience.type === 'story';

    const handleSave = () => {
        const updates: Partial<Experience> = {
            activity_name: editName,
            activity_date: editDate,
            activity_type: editType,
        };
        if (isStory) {
            updates.story_title = editStoryTitle;
        }
        onUpdate(experience.id, updates);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditName(experience.activity_name);
        setEditDate(experience.activity_date);
        setEditType(experience.activity_type || '기타');
        setEditStoryTitle(experience.story_title || '');
        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-50 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 relative animate-slide-in-up" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors flex items-center justify-center text-slate-600 z-10">
                    <span className="text-xl">✕</span>
                </button>
                
                <div className="pb-6 mb-6 border-b border-slate-200">
                    {isEditing ? (
                        <div className="space-y-4 pr-12">
                            {isStory && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">스토리 제목</label>
                                    <input 
                                        type="text" 
                                        value={editStoryTitle} 
                                        onChange={(e) => setEditStoryTitle(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xl font-bold text-black bg-white !bg-white !text-black"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">활동명</label>
                                <div className="relative group">
                                    <input 
                                        type="text" 
                                        value={editName} 
                                        onChange={(e) => {
                                            setEditName(e.target.value);
                                            setShowSuggestions(true);
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        className={`w-full p-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-black bg-white !bg-white !text-black ${isStory ? 'text-base' : 'text-2xl'}`}
                                        placeholder="활동명을 입력하거나 선택하세요"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                        <ChevronDownIcon className="w-5 h-5" />
                                    </div>
                                    
                                    {showSuggestions && (
                                        <ul className="absolute z-20 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1 left-0">
                                            {filteredSuggestions.length > 0 ? filteredSuggestions.map((name, idx) => (
                                                <li 
                                                    key={idx} 
                                                    onMouseDown={(e) => {
                                                        e.preventDefault(); // Prevent blur
                                                        setEditName(name);
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-slate-700 text-sm border-b border-slate-50 last:border-0 transition-colors"
                                                >
                                                    {name}
                                                </li>
                                            )) : (
                                                <li className="px-4 py-2 text-slate-400 text-sm italic">
                                                    새로운 활동으로 입력됩니다.
                                                </li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">활동 기간</label>
                                <input 
                                    type="text" 
                                    value={editDate} 
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-black bg-white !bg-white !text-black"
                                    placeholder="YYYY.MM ~ YYYY.MM"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">활동 카테고리</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALLOWED_CATEGORIES.map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => setEditType(cat)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                                editType === cat
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100 hover:border-indigo-300'
                                            }`}
                                        >
                                            {cat}
                                            {editType === cat && <span className="ml-1">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={handleCancel} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300">
                                    <XCircleIcon className="w-4 h-4" /> 취소
                                </button>
                                <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-500 rounded-lg hover:bg-indigo-600">
                                    <CheckIcon className="w-4 h-4" /> 저장
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-start gap-8 pr-12">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-3xl font-bold text-slate-800 break-keep leading-tight">
                                    {isStory ? experience.story_title : experience.activity_name}
                                </h2>
                                {isStory && <p className="text-lg text-indigo-500 font-semibold mt-2">{experience.activity_name}</p>}
                                <div className="flex flex-wrap gap-2 mt-4">
                                    <span className="inline-block bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">📅 {experience.activity_date || '날짜 미상'}</span>
                                    <span className="inline-block bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">📁 {experience.activity_type || '기타'}</span>
                                    {isStory && experience.core_competency && <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">💡 {experience.core_competency}</span>}
                                    {isStory && experience.job_alignment && <span className="inline-block bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-1 rounded-full">💼 {experience.job_alignment}</span>}
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="p-2 text-slate-400 hover:text-indigo-500 transition-colors flex-shrink-0 mt-1"
                                title="수정"
                            >
                                <PencilSquareIcon className="w-6 h-6" />
                            </button>
                        </div>
                    )}
                </div>

                {isStory ? <StoryView experience={experience} /> : <BasicView experience={experience} allExperiences={experiences} onNavigateToStory={onNavigateToStory} onUpdate={onUpdate} />}
                
                <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end">
                    <button onClick={() => onDelete(experience.id)} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                        삭제하기
                    </button>
                </div>
            </div>
        </div>
    );
};

const Section: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-8">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
        <div className="text-base text-slate-700 leading-relaxed bg-white p-4 rounded-xl border border-slate-200">{children}</div>
    </div>
);

const BasicView: React.FC<{ experience: Experience, allExperiences: Experience[], onNavigateToStory: (storyId: string) => void, onUpdate: (id: string, updates: Partial<Experience>) => void }> = ({ experience, allExperiences, onNavigateToStory, onUpdate }) => {
    const relatedStories = allExperiences.filter(e => e.type === 'story' && e.activity_name === experience.activity_name);
    const [isGenerating, setIsGenerating] = useState(false);

    const postContent = [
        experience.result_achievement && `결과: ${experience.result_achievement}`,
        experience.key_insight && `배움: ${experience.key_insight}`
    ].filter(Boolean).join('\n\n');

    const handleGenerateSummary = useCallback(async (isAuto: boolean = false, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (!isAuto && !confirm("연관 스토리를 바탕으로 활동 내용을 자동으로 요약하시겠습니까?\n기존 내용은 새로운 요약으로 덮어씌워집니다.")) return;
        
        setIsGenerating(true);
        try {
            const storiesText = relatedStories.map((s, i) => `
                [Story ${i+1}: ${s.story_title}]
                Situation: ${s.situation}
                Task: ${s.task}
                Action: ${s.action}
                Result: ${s.result_quantitative} / ${s.result_qualitative}
                Learning: ${s.learning}
            `).join('\n\n');

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const prompt = `
            Based on the following STAR stories related to the activity "${experience.activity_name}", please summarize the entire activity into 4 concise sections.
            
            **Rules:**
            1. Language: **Korean (한국어)**
            2. Length: Each section should be **roughly 3 lines**.
            3. Tone: Professional yet personal (resume style or self-introduction style).
            
            **Sections to generate:**
            1. **detailed_content**: An overall summary of what this activity was about.
            2. **why**: Motivation/Background (Situation & Task context).
            3. **how**: Process/Effort (Action context).
            4. **result_achievement**: Outcomes (Quantitative/Qualitative Results).
            5. **key_insight**: Key learnings or growth points.

            [Stories Data]
            ${storiesText}
            `;

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: "application/json",
                    temperature: 0.4, // Lower temperature for more factual summaries
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            detailed_content: { type: "STRING" },
                            why: { type: "STRING" },
                            how: { type: "STRING" },
                            result_achievement: { type: "STRING" },
                            key_insight: { type: "STRING" }
                        },
                        required: ["detailed_content", "why", "how", "result_achievement", "key_insight"]
                    } as any 
                }
            });

            const data = JSON.parse(result.text || "{}");
            
            onUpdate(experience.id, {
                detailed_content: data.detailed_content,
                why: data.why,
                how: data.how,
                result_achievement: data.result_achievement,
                key_insight: data.key_insight
            });

        } catch (error) {
            console.error("Summarization failed:", error);
            if (!isAuto) alert("요약 생성 중 오류가 발생했습니다.");
        } finally {
            setIsGenerating(false);
        }
    }, [experience.id, experience.activity_name, relatedStories, onUpdate]);

    // Auto-generate if empty content and has stories
    useEffect(() => {
        // Trigger only if detailed content is empty AND there are stories AND we are not already generating
        if (relatedStories.length > 0 && !experience.detailed_content && !isGenerating) {
            handleGenerateSummary(true);
        }
    }, [experience.id, relatedStories.length, experience.detailed_content]); // Dependencies ensure it runs when opened or data loads

    return (
        <div>
            {relatedStories.length > 0 && (
                <div className="mb-4 flex justify-end">
                    <button 
                        onClick={(e) => handleGenerateSummary(false, e)}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? <LoadingSpinner isWhite={false} /> : <SparklesIcon className="w-4 h-4" />}
                        {isGenerating ? "자동 요약 생성 중..." : "연관 스토리 기반 3줄 요약 생성"}
                    </button>
                </div>
            )}

            <Section title="📄 활동 개요">
                <div className="whitespace-pre-wrap">
                    {experience.detailed_content || (isGenerating ? <span className="text-slate-400 animate-pulse">요약 생성 중...</span> : "상세 내용이 없습니다.")}
                </div>
            </Section>

            <Section title="⏮️ 활동 전">
                <div className="whitespace-pre-wrap">
                    {experience.why || (isGenerating ? <span className="text-slate-400 animate-pulse">요약 생성 중...</span> : "내용이 없습니다.")}
                </div>
            </Section>

            <Section title="▶️ 활동 중">
                <div className="whitespace-pre-wrap">
                    {experience.how || (isGenerating ? <span className="text-slate-400 animate-pulse">요약 생성 중...</span> : "내용이 없습니다.")}
                </div>
            </Section>

            <Section title="⏭️ 활동 후">
                <div className="whitespace-pre-wrap">
                    {postContent || (isGenerating ? <span className="text-slate-400 animate-pulse">요약 생성 중...</span> : "내용이 없습니다.")}
                </div>
            </Section>

            <Section title="📦 연관 스토리">
                {relatedStories.length > 0 ? (
                    <ul className="space-y-2">
                        {relatedStories.map(story => (
                            <li key={story.id}>
                                <button
                                    onClick={() => onNavigateToStory(story.id)}
                                    className="w-full text-left p-4 bg-slate-100 hover:bg-indigo-100 rounded-lg transition-colors group"
                                >
                                    <p className="font-semibold text-indigo-700">{story.story_title}</p>
                                    <p className="text-sm text-slate-600 mt-1 line-clamp-2 group-hover:text-indigo-900">{story.story_summary}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-slate-500 italic">아직 연관된 스토리가 없습니다.</p>
                )}
            </Section>
        </div>
    );
};

const StoryView: React.FC<{ experience: Experience }> = ({ experience }) => (
    <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <StarItem label="Situation" value={experience.situation} />
            <StarItem label="Task" value={experience.task} />
            <StarItem label="Action" value={experience.action} />
            <div className="md:col-span-2">
                <StarItem label="Result" value={
                    <div className="space-y-2">
                        <p><strong>정량적:</strong> {experience.result_quantitative || 'N/A'}</p>
                        <p><strong>정성적:</strong> {experience.result_qualitative || 'N/A'}</p>
                    </div>
                } />
            </div>
        </div>
        <Section title="📚 배움과 성장">{experience.learning}</Section>
    </div>
);

const StarItem: React.FC<{ label: string, value: React.ReactNode }> = ({ label, value }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-600 uppercase mb-2">
            <StarIcon className="w-4 h-4" />
            {label}
        </div>
        <div className="text-sm text-slate-800 leading-relaxed">{value}</div>
    </div>
);

export default DetailModal;
