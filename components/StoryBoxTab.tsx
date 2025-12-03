
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Experience } from '../types';
import { LightBulbIcon, BriefcaseIcon, TrashIcon, SearchIcon, ChevronDownIcon, LoadingSpinner, ListBulletIcon, Squares2X2Icon, BoxIcon, FunnelIcon, PencilIcon, CalendarIcon } from './icons';

interface StoryBoxTabProps {
    experiences: Experience[];
    onShowDetail: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Experience>) => void;
    onDelete: (id: string) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    loadingMore: boolean;
    highlightedStoryId?: string | null;
    clearHighlightedStory?: () => void;
}

type StorySortOrder = 'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'name-asc' | 'name-desc';
type ViewMode = 'grouped' | 'competency' | 'grid';

const STORY_SORT_OPTIONS: { value: StorySortOrder, label: string }[] = [
    { value: 'date-desc', label: '최신 경험순' },
    { value: 'date-asc', label: '오래된 경험순' },
    { value: 'created-desc', label: '최근 생성순' },
    { value: 'created-asc', label: '오래된 생성순' },
    { value: 'name-asc', label: '이름 오름차순' },
    { value: 'name-desc', label: '이름 내림차순' },
];

// Helper to normalize category names for grouping
const normalizeCategory = (type: string | undefined) => {
    if (!type) return '기타';
    if (type === '알바') return '아르바이트';
    if (type === '팀플') return '프로젝트';
    return type;
};

const StoryBox = React.forwardRef<HTMLDivElement, { 
    experience: Experience; 
    onShowDetail: (id: string) => void; 
    onDelete: (id: string) => void; 
    onUpdate: (id: string, updates: Partial<Experience>) => void;
}>(({ experience, onShowDetail, onDelete, onUpdate }, ref) => {
    const [isEditingDate, setIsEditingDate] = useState(false);
    const [dateValue, setDateValue] = useState(experience.activity_date || '');

    useEffect(() => {
        setDateValue(experience.activity_date || '');
    }, [experience.activity_date]);

    const saveDate = () => {
        if (dateValue !== experience.activity_date) {
            onUpdate(experience.id, { activity_date: dateValue });
        }
        setIsEditingDate(false);
    };

    // Parse keywords for clean display (Max 2 for each type to avoid clutter)
    const skills = useMemo(() => 
        (experience.core_competency || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 2), 
        [experience.core_competency]
    );
    
    const jobs = useMemo(() => 
        (experience.job_alignment || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 1), 
        [experience.job_alignment]
    );

    return (
    <div ref={ref} className="bg-white rounded-xl shadow-sm p-5 border border-slate-200 group transition-all hover:shadow-md hover:border-indigo-300 flex flex-col h-full animate-fade-in relative overflow-hidden">
        {/* Activity Type Badge - Top Right */}
        <div className="absolute top-4 right-4">
             <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
                {experience.activity_type || '기타'}
             </span>
        </div>

        <div className="flex-1 cursor-pointer" onClick={() => onShowDetail(experience.id)}>
            {/* Header: Activity Name & Title */}
            <div className="mb-3 pr-16">
                <p className="text-xs text-indigo-500 font-bold mb-1 truncate">{experience.activity_name}</p>
                <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2">
                    {experience.story_title}
                </h3>
            </div>

            {/* Tags Area: Cleaned up */}
            <div className="flex flex-wrap gap-1.5 mb-4 min-h-[24px]">
                {jobs.map((job, i) => (
                    <span key={`j-${i}`} className="inline-block bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-100">
                        {job}
                    </span>
                ))}
                {skills.map((skill, i) => (
                    <span key={`s-${i}`} className="inline-block bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-100">
                        {skill}
                    </span>
                ))}
            </div>

            {/* Summary Text: Truncated */}
            <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed mb-1">
                {experience.story_summary || experience.detailed_content || "요약 내용이 없습니다."}
            </p>
        </div>

        {/* Footer: Date & Actions */}
        <div className="flex justify-between items-end pt-3 mt-auto border-t border-slate-50">
             <div onClick={(e) => e.stopPropagation()}>
                    {isEditingDate ? (
                         <div className="flex items-center gap-1 mt-1">
                            <input 
                                type="text" 
                                value={dateValue}
                                onChange={(e) => setDateValue(e.target.value)}
                                onBlur={saveDate}
                                onKeyDown={(e) => e.key === 'Enter' && saveDate()}
                                autoFocus
                                placeholder="YYYY.MM"
                                className="text-xs border border-indigo-300 rounded px-1 py-0.5 w-full max-w-[100px] focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-black !bg-white !text-black"
                            />
                         </div>
                    ) : (
                        <p className="text-xs text-slate-400 flex items-center gap-1 group/date mt-1 h-6 font-medium">
                            <CalendarIcon className="w-3 h-3 text-slate-300" />
                            <span className={!experience.activity_date ? "text-slate-300 italic" : ""}>
                                {experience.activity_date || "날짜 미상"}
                            </span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingDate(true);
                                }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-indigo-600 transition-colors ml-1 opacity-0 group-hover/date:opacity-100"
                                aria-label="날짜 수정"
                                title="날짜 수정"
                            >
                                <PencilIcon className="w-3 h-3" />
                            </button>
                        </p>
                    )}
             </div>
             <button 
                onClick={(e) => { e.stopPropagation(); onDelete(experience.id); }} 
                className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                title="휴지통으로 이동"
            >
                 <TrashIcon className="w-4 h-4" />
             </button>
        </div>
    </div>
    );
});


const StoryBoxTab: React.FC<StoryBoxTabProps> = ({ experiences, onShowDetail, onDelete, onUpdate, onLoadMore, hasMore, loadingMore, highlightedStoryId, clearHighlightedStory }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('grouped');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<StorySortOrder>('date-desc');
    
    // For Yearly Grouping
    const [expandedYearGroups, setExpandedYearGroups] = useState<Record<string, boolean>>({});
    // For Competency Grouping
    const [expandedCompetencyGroups, setExpandedCompetencyGroups] = useState<Record<string, boolean>>({});

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

    // Filter only stories
    const storyExperiences = useMemo(() => {
        return experiences.filter(exp => exp.type === 'story');
    }, [experiences]);
    
    // Apply Search
    const filteredExperiences = useMemo(() => {
        if (!searchQuery) return storyExperiences;
        const lowerQuery = searchQuery.toLowerCase();
        return storyExperiences.filter(exp =>
            (exp.story_title || '').toLowerCase().includes(lowerQuery) ||
            (exp.story_summary || '').toLowerCase().includes(lowerQuery) ||
            (exp.activity_name || '').toLowerCase().includes(lowerQuery)
        );
    }, [storyExperiences, searchQuery]);

    // --- Logic for Yearly Grouped View ---
    const groupedData = useMemo(() => {
        const groups: Record<string, Record<string, Experience[]>> = {};

        filteredExperiences.forEach(exp => {
            let year = '연도 미상';
            const yearMatch = exp.activity_date?.match(/\d{4}/);
            if (yearMatch) {
                year = `${yearMatch[0]}년`;
            }

            const category = normalizeCategory(exp.activity_type);

            if (!groups[year]) groups[year] = {};
            if (!groups[year][category]) groups[year][category] = [];

            groups[year][category].push(exp);
        });

        // Sort experiences within categories by date (descending)
        Object.keys(groups).forEach(year => {
            Object.keys(groups[year]).forEach(cat => {
                groups[year][cat].sort((a, b) => (b.activity_date || '').localeCompare(a.activity_date || ''));
            });
        });

        return groups;
    }, [filteredExperiences]);

    const sortedYears = useMemo(() => {
        return Object.keys(groupedData).sort((a, b) => {
            if (a === '연도 미상') return 1;
            if (b === '연도 미상') return -1;
            return b.localeCompare(a);
        });
    }, [groupedData]);

    // --- Logic for Competency Grouped View ---
    const competencyGroupedData = useMemo(() => {
        const groups: Record<string, Experience[]> = {};

        filteredExperiences.forEach(exp => {
            // Split by comma, trim, filter empty
            let comps = (exp.core_competency || '').split(',').map(s => s.trim()).filter(Boolean);
            
            if (comps.length === 0) {
                comps = ['미분류'];
            }

            comps.forEach(comp => {
                if (!groups[comp]) {
                    groups[comp] = [];
                }
                groups[comp].push(exp);
            });
        });

        // Sort experiences inside groups by date desc
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                 return (b.activity_date || '').localeCompare(a.activity_date || '');
            });
        });

        return groups;
    }, [filteredExperiences]);

    const sortedCompetencies = useMemo(() => {
        return Object.keys(competencyGroupedData).sort((a, b) => {
            if (a === '미분류') return 1;
            if (b === '미분류') return -1;
            // Sort by count desc
            return competencyGroupedData[b].length - competencyGroupedData[a].length;
        });
    }, [competencyGroupedData]);

    // Initialize default expanded state for Years
    useEffect(() => {
        if (sortedYears.length > 0) {
            setExpandedYearGroups(prev => {
                const next = { ...prev };
                let hasChanges = false;
                sortedYears.forEach(year => {
                    Object.keys(groupedData[year]).forEach(cat => {
                        const key = `${year}-${cat}`;
                        if (next[key] === undefined) {
                            next[key] = true; // Default to expanded
                            hasChanges = true;
                        }
                    });
                });
                return hasChanges ? next : prev;
            });
        }
    }, [sortedYears, groupedData]);

    // Initialize default expanded state for Competencies
    useEffect(() => {
        if (sortedCompetencies.length > 0) {
             setExpandedCompetencyGroups(prev => {
                const next = { ...prev };
                let hasChanges = false;
                sortedCompetencies.forEach(comp => {
                    if (next[comp] === undefined) {
                        next[comp] = true; // Default to expanded
                        hasChanges = true;
                    }
                });
                return hasChanges ? next : prev;
            });
        }
    }, [sortedCompetencies]);

    const toggleYearGroup = (groupKey: string) => {
        setExpandedYearGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    const toggleCompetencyGroup = (groupKey: string) => {
        setExpandedCompetencyGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    // --- Logic for Grid View (Existing Logic) ---
    const sortedGridExperiences = useMemo(() => {
        return [...filteredExperiences].sort((a, b) => {
             try {
                switch (sortOrder) {
                    case 'date-asc':
                        return new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime();
                    case 'created-desc':
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    case 'created-asc':
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    case 'name-asc':
                        return (a.story_title || '').localeCompare(b.story_title || '');
                    case 'name-desc':
                        return (b.story_title || '').localeCompare(a.story_title || '');
                    case 'date-desc':
                    default:
                        return new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime();
                }
            } catch (e) {
                return b.sequence_number - a.sequence_number;
            }
        });
    }, [filteredExperiences, sortOrder]);

    // Render Grid View Content
    const renderGridView = () => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                {sortedGridExperiences.map(exp => <StoryBox ref={el => { if (el) storyRefs.current[exp.id] = el; }} key={exp.id} experience={exp} onShowDetail={onShowDetail} onDelete={onDelete} onUpdate={onUpdate} />)}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header Area */}
            <div className="p-4 bg-white border-b border-slate-200 sticky top-0 z-10 space-y-3 shadow-sm">
                 <div className="relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="스토리 검색 (제목, 내용)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 bg-slate-50 text-slate-900 transition-all"
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* View Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
                        <button
                            onClick={() => setViewMode('grouped')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                                viewMode === 'grouped' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'
                            }`}
                        >
                            <ListBulletIcon className="w-4 h-4" />
                            연도별
                        </button>
                        <button
                            onClick={() => setViewMode('competency')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                                viewMode === 'competency' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'
                            }`}
                        >
                            <LightBulbIcon className="w-4 h-4" />
                            역량별
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-2 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                                viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'
                            }`}
                        >
                            <Squares2X2Icon className="w-4 h-4" />
                            전체
                        </button>
                    </div>

                    {/* Sorting Options (Only for Grid View) */}
                    {viewMode === 'grid' && (
                        <div className="relative w-full sm:w-auto">
                            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value as StorySortOrder)}
                                className="w-full sm:w-auto pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500 text-slate-700 appearance-none cursor-pointer"
                            >
                                {STORY_SORT_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 scroll-smooth">
                {filteredExperiences.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <BriefcaseIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">{searchQuery ? '검색 결과가 없습니다.' : '저장된 스토리가 없습니다.'}</p>
                        <p className="text-sm mt-1">경험 입력 탭에서 스토리를 생성해보세요.</p>
                    </div>
                ) : (
                    <>
                        {/* VIEW MODE: GROUPED (YEARLY) */}
                        {viewMode === 'grouped' && sortedYears.map(year => (
                            <div key={year} className="animate-fade-in-up">
                                <div className="flex items-center gap-4 mb-4 sticky top-0 bg-slate-50/95 backdrop-blur-sm py-2 z-10">
                                    <h2 className="text-2xl font-extrabold text-slate-800">{year}</h2>
                                    <div className="h-0.5 flex-1 bg-slate-200 rounded-full"></div>
                                </div>

                                <div className="space-y-4">
                                    {Object.keys(groupedData[year]).sort().map(category => {
                                        const groupKey = `${year}-${category}`;
                                        const isExpanded = expandedYearGroups[groupKey];
                                        const items = groupedData[year][category];

                                        return (
                                            <div key={groupKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-100">
                                                <button 
                                                    onClick={() => toggleYearGroup(groupKey)}
                                                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            <BoxIcon className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-700 text-lg">{category}</h3>
                                                            <p className="text-xs text-slate-400 font-medium">{items.length}개의 스토리</p>
                                                        </div>
                                                    </div>
                                                    <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                        <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <div className="p-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                                                            {items.map(exp => (
                                                                <StoryBox 
                                                                    key={exp.id} 
                                                                    ref={el => { if (el) storyRefs.current[exp.id] = el; }}
                                                                    experience={exp} 
                                                                    onShowDetail={onShowDetail} 
                                                                    onDelete={onDelete} 
                                                                    onUpdate={onUpdate}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* VIEW MODE: COMPETENCY (NEW) */}
                        {viewMode === 'competency' && (
                            <div className="animate-fade-in-up space-y-4">
                                <div className="flex items-center gap-2 mb-6">
                                    <LightBulbIcon className="w-6 h-6 text-amber-500" />
                                    <h2 className="text-2xl font-extrabold text-slate-800">역량별 보기</h2>
                                </div>
                                
                                {sortedCompetencies.map(comp => {
                                    const isExpanded = expandedCompetencyGroups[comp];
                                    const items = competencyGroupedData[comp];

                                    return (
                                        <div key={comp} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:border-amber-100">
                                            <button 
                                                onClick={() => toggleCompetencyGroup(comp)}
                                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${isExpanded ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        <LightBulbIcon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-700 text-lg">{comp}</h3>
                                                        <p className="text-xs text-slate-400 font-medium">{items.length}개의 스토리</p>
                                                    </div>
                                                </div>
                                                <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                    <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="p-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                                                        {items.map(exp => (
                                                            <StoryBox 
                                                                key={`${comp}-${exp.id}`} // Unique key since exp can duplicate across groups
                                                                ref={el => { if (el) storyRefs.current[exp.id] = el; }}
                                                                experience={exp} 
                                                                onShowDetail={onShowDetail} 
                                                                onDelete={onDelete} 
                                                                onUpdate={onUpdate}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* VIEW MODE: GRID */}
                        {viewMode === 'grid' && renderGridView()}

                        {/* Infinite Scroll Button */}
                        {hasMore && (
                             <div className="text-center mt-6 col-span-full pb-8">
                                <button
                                    onClick={onLoadMore}
                                    disabled={loadingMore}
                                    className="px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50 flex items-center justify-center mx-auto"
                                >
                                    {loadingMore ? <LoadingSpinner isWhite={false} /> : '더 보기'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StoryBoxTab;
