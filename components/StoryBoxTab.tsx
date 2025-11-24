

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Experience } from '../types';
import { LightBulbIcon, BriefcaseIcon, TrashIcon, SearchIcon, ChevronDownIcon, LoadingSpinner } from './icons';

interface StoryBoxTabProps {
    experiences: Experience[];
    onShowDetail: (id: string) => void;
    onDelete: (id: string) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    loadingMore: boolean;
    highlightedStoryId?: string | null;
    clearHighlightedStory?: () => void;
}

type SortMode = 'all' | 'job' | 'competency';
type StorySortOrder = 'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'name-asc' | 'name-desc';

const STORY_SORT_OPTIONS: { value: StorySortOrder, label: string }[] = [
    { value: 'date-desc', label: '최신 경험순' },
    { value: 'date-asc', label: '오래된 경험순' },
    { value: 'created-desc', label: '최근 생성순' },
    { value: 'created-asc', label: '오래된 생성순' },
    { value: 'name-asc', label: '이름 오름차순' },
    { value: 'name-desc', label: '이름 내림차순' },
];

const StoryBoxTab: React.FC<StoryBoxTabProps> = ({ experiences, onShowDetail, onDelete, onLoadMore, hasMore, loadingMore, highlightedStoryId, clearHighlightedStory }) => {
    const [sortMode, setSortMode] = useState<SortMode>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<StorySortOrder>('date-desc');
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const storyRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (highlightedStoryId && storyRefs.current[highlightedStoryId]) {
            const element = storyRefs.current[highlightedStoryId];
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            element?.classList.add('highlight-animation');
            
            const timer = setTimeout(() => {
                element?.classList.remove('highlight-animation');
                if (clearHighlightedStory) {
                    clearHighlightedStory();
                }
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [highlightedStoryId, clearHighlightedStory]);

    const storyExperiences = useMemo(() => {
        const sorted = [...experiences.filter(exp => exp.type === 'story')].sort((a, b) => {
            try {
                switch (sortOrder) {
                    case 'date-asc':
                        return new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime();
                    case 'created-desc':
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    case 'created-asc':
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    case 'name-asc':
                        return a.story_title.localeCompare(b.story_title);
                    case 'name-desc':
                        return b.story_title.localeCompare(a.story_title);
                    case 'date-desc':
                    default:
                        return new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime();
                }
            } catch (e) {
                return b.sequence_number - a.sequence_number;
            }
        });
        return sorted;
    }, [experiences, sortOrder]);
    
    const filteredExperiences = useMemo(() => {
        if (!searchQuery) return storyExperiences;
        return storyExperiences.filter(exp =>
            exp.story_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exp.story_summary.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [storyExperiences, searchQuery]);

    const toggleGroup = (groupName: string) => {
        setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    };

    // FIX: Refactored rendering logic to remove redundancy and potential type errors.
    const renderContent = () => {
        if (filteredExperiences.length === 0) {
            return (
                <div className="text-center py-20 text-slate-500 col-span-full">
                    <BriefcaseIcon className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-lg">{searchQuery ? '검색 결과가 없습니다.' : '저장된 스토리가 없습니다.'}</p>
                    <p className="text-sm mt-1">경험 입력 탭에서 스토리를 생성해보세요.</p>
                </div>
            );
        }

        if (sortMode === 'all' || searchQuery) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredExperiences.map(exp => <StoryBox ref={el => { if (el) storyRefs.current[exp.id] = el; }} key={exp.id} experience={exp} onShowDetail={onShowDetail} onDelete={onDelete} />)}
                </div>
            );
        }

        const groupKey: keyof Experience = sortMode === 'job' ? 'job_alignment' : 'core_competency';
        const groups = filteredExperiences.reduce<Record<string, Experience[]>>((acc, exp) => {
            const keys = ((exp[groupKey] as string) || '미분류').split(',').map(k => k.trim());
            keys.forEach(key => {
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(exp);
            });
            return acc;
        }, {});
        
        // FIX: Replaced Object.entries with Object.keys to correctly infer the type of the 'exps' array, fixing 'unknown' type errors.
        return Object.keys(groups).map((groupName) => {
            const exps = groups[groupName];
            return (
                <div key={groupName} className="mb-6">
                    <div onClick={() => toggleGroup(groupName)} className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm cursor-pointer mb-4 border border-slate-200">
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${sortMode === 'job' ? 'bg-indigo-100' : 'bg-amber-100'}`}>
                               {sortMode === 'job' ? <BriefcaseIcon className="w-6 h-6 text-indigo-500" /> : <LightBulbIcon className="w-6 h-6 text-amber-500" />}
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">{groupName}</h3>
                            <span className="text-sm font-semibold text-slate-500 bg-slate-200 px-2.5 py-1 rounded-full">{exps.length}</span>
                        </div>
                        <ChevronDownIcon className={`w-6 h-6 text-slate-500 transition-transform ${openGroups[groupName] ? 'rotate-180' : ''}`} />
                    </div>
                    {openGroups[groupName] && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-down pl-4">
                             {exps.map(exp => <StoryBox ref={el => { if (el) storyRefs.current[exp.id] = el; }} key={exp.id} experience={exp} onShowDetail={onShowDetail} onDelete={onDelete} />)}
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="스토리 검색..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-slate-100 text-slate-900"
                        />
                    </div>
                    <div className="flex-shrink-0">
                         <select
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as StorySortOrder)}
                            className="w-full sm:w-auto h-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white text-slate-700"
                        >
                            {STORY_SORT_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                 </div>
                 <div className="mt-4 flex items-center justify-center">
                    <div className="relative flex bg-slate-200 p-1 rounded-full text-sm font-semibold">
                        <span className={`absolute top-1 bottom-1 left-1 w-1/3 bg-white rounded-full shadow-md transition-transform duration-300 ease-in-out`} style={{ transform: `translateX(${sortMode === 'all' ? 0 : sortMode === 'job' ? 100 : 200}%)` }}></span>
                        <button onClick={() => setSortMode('all')} className={`relative z-10 w-24 py-1.5 transition-colors ${sortMode === 'all' ? 'text-indigo-600' : 'text-slate-600'}`}>전체 보기</button>
                        <button onClick={() => setSortMode('job')} className={`relative z-10 w-24 py-1.5 transition-colors ${sortMode === 'job' ? 'text-indigo-600' : 'text-slate-600'}`}>직무별</button>
                        <button onClick={() => setSortMode('competency')} className={`relative z-10 w-24 py-1.5 transition-colors ${sortMode === 'competency' ? 'text-indigo-600' : 'text-slate-600'}`}>역량별</button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {renderContent()}
                {hasMore && (
                    <div className="text-center mt-6 col-span-full">
                        <button
                            onClick={onLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50 flex items-center justify-center mx-auto"
                        >
                            {loadingMore ? <LoadingSpinner isWhite={false} /> : '더 보기'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const StoryBox = React.forwardRef<HTMLDivElement, { experience: Experience; onShowDetail: (id: string) => void; onDelete: (id: string) => void; }>(({ experience, onShowDetail, onDelete }, ref) => (
    <div ref={ref} className="bg-white rounded-xl shadow-sm p-5 border border-slate-200 group transition-all hover:shadow-md hover:border-indigo-300 flex flex-col">
        <div className="flex-1 cursor-pointer" onClick={() => onShowDetail(experience.id)}>
            <div className="flex items-start justify-between mb-3">
                <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-full">{experience.job_alignment}</span>
                 <span className="inline-block bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">{experience.core_competency}</span>
            </div>
            <h3 className="font-bold text-lg text-slate-800 group-hover:text-indigo-600 transition-colors mb-2">{experience.story_title}</h3>
            <p className="text-sm text-slate-500 line-clamp-3 flex-1">{experience.story_summary}</p>
        </div>
        <div className="flex justify-between items-end pt-3 mt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{experience.activity_date}</p>
            <button 
                onClick={(e) => { e.stopPropagation(); onDelete(experience.id); }} 
                className="p-2 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="삭제"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
    </div>
));

export default StoryBoxTab;
