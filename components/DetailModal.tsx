
import React, { useState, useEffect } from 'react';
import { Experience } from '../types';
import { TrashIcon, StarIcon, PencilSquareIcon, CheckIcon, XCircleIcon } from './icons';

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
    const [editStoryTitle, setEditStoryTitle] = useState(experience.story_title || '');

    useEffect(() => {
        setEditName(experience.activity_name);
        setEditDate(experience.activity_date);
        setEditStoryTitle(experience.story_title || '');
        setIsEditing(false);
    }, [experience]);

    if (!isOpen) return null;

    const isStory = experience.type === 'story';

    const handleSave = () => {
        const updates: Partial<Experience> = {
            activity_name: editName,
            activity_date: editDate,
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
        setEditStoryTitle(experience.story_title || '');
        setIsEditing(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-50 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8 relative animate-slide-in-up" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 bg-slate-200 rounded-full hover:bg-slate-300 transition-colors flex items-center justify-center text-slate-600">
                    <span className="text-xl">✕</span>
                </button>
                
                <div className="pb-6 mb-6 border-b border-slate-200 relative">
                    {!isEditing && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="absolute top-0 right-12 p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                            title="수정"
                        >
                            <PencilSquareIcon className="w-5 h-5" />
                        </button>
                    )}

                    {isEditing ? (
                        <div className="space-y-4 pr-12">
                            {isStory && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">스토리 제목</label>
                                    <input 
                                        type="text" 
                                        value={editStoryTitle} 
                                        onChange={(e) => setEditStoryTitle(e.target.value)}
                                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xl font-bold text-slate-800"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">활동명</label>
                                <input 
                                    type="text" 
                                    value={editName} 
                                    onChange={(e) => setEditName(e.target.value)}
                                    className={`w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold text-slate-800 ${isStory ? 'text-base' : 'text-2xl'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">활동 기간</label>
                                <input 
                                    type="text" 
                                    value={editDate} 
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm text-slate-700"
                                    placeholder="YYYY.MM ~ YYYY.MM"
                                />
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
                        <>
                            <h2 className="text-3xl font-bold text-slate-800 pr-12">{isStory ? experience.story_title : experience.activity_name}</h2>
                            {isStory && <p className="text-lg text-indigo-500 font-semibold mt-1">{experience.activity_name}</p>}
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="inline-block bg-slate-200 text-slate-700 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">📅 {experience.activity_date}</span>
                                <span className="inline-block bg-slate-200 text-slate-700 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">📁 {experience.activity_type}</span>
                                {isStory && <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">💡 {experience.core_competency}</span>}
                                {isStory && <span className="inline-block bg-sky-100 text-sky-800 text-xs font-semibold mr-2 px-2.5 py-1 rounded-full">💼 {experience.job_alignment}</span>}
                            </div>
                        </>
                    )}
                </div>

                {isStory ? <StoryView experience={experience} /> : <BasicView experience={experience} allExperiences={experiences} onNavigateToStory={onNavigateToStory} />}
                
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

const BasicView: React.FC<{ experience: Experience, allExperiences: Experience[], onNavigateToStory: (storyId: string) => void }> = ({ experience, allExperiences, onNavigateToStory }) => {
    const relatedStories = allExperiences.filter(e => e.type === 'story' && e.activity_name === experience.activity_name);
    
    const postContent = [
        experience.result_achievement && `결과: ${experience.result_achievement}`,
        experience.key_insight && `배움: ${experience.key_insight}`
    ].filter(Boolean).join('\n\n');

    return (
        <div>
            <Section title="📄 활동 개요">
                <div className="whitespace-pre-wrap">
                    {experience.detailed_content || "상세 내용이 없습니다."}
                </div>
            </Section>

            <Section title="⏮️ 활동 전">
                <div className="whitespace-pre-wrap">
                    {experience.why || "내용이 없습니다."}
                </div>
            </Section>

            <Section title="▶️ 활동 중">
                <div className="whitespace-pre-wrap">
                    {experience.how || "내용이 없습니다."}
                </div>
            </Section>

            <Section title="⏭️ 활동 후">
                <div className="whitespace-pre-wrap">
                    {postContent || "내용이 없습니다."}
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
