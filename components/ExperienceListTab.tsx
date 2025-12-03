
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Experience } from '../types';
import { FolderIcon, TrashIcon, SearchIcon, LoadingSpinner, ChevronDownIcon, CalendarIcon, BoxIcon, Squares2X2Icon, ListBulletIcon, FunnelIcon, PencilIcon } from './icons';

interface ExperienceListTabProps {
    experiences: Experience[];
    onShowDetail: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Experience>) => void;
    onDelete: (id: string) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    loadingMore: boolean;
}

const SORT_OPTIONS = [
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

const ExperienceCard: React.FC<{ experience: Experience; onShowDetail: (id: string) => void; onDelete: (id: string) => void; onUpdate: (id: string, updates: Partial<Experience>) => void; }> = ({ experience, onShowDetail, onDelete, onUpdate }) => {
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

    const isStory = experience.type === 'story';

    return (
        <div className={`bg-white rounded-xl shadow-sm p-4 border transition-all hover:shadow-md hover:border-indigo-300 flex flex-col h-full animate-fade-in group ${isStory ? 'border-indigo-200 ring-1 ring-indigo-50' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200">
                        {experience.activity_type || '미분류'}
                    </span>
                    {isStory && (
                        <span className="inline-block bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-100 flex items-center gap-1">
                            <span>★</span> 스토리
                        </span>
                    )}
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(experience.id); }} 
                    className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="삭제"
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
            
            <div className="cursor-pointer flex-1" onClick={() => onShowDetail(experience.id)}>
                <h3 className="font-bold text-base text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-1">
                    {experience.activity_name}
                </h3>
                
                <div onClick={(e) => e.stopPropagation()}>
                    {isEditingDate ? (
                         <div className="flex items-center gap-1 mt-1 mb-2">
                            <input 
                                type="text" 
                                value={dateValue}
                                onChange={(e) => setDateValue(e.target.value)}
                                onBlur={saveDate}
                                onKeyDown={(e) => e.key === 'Enter' && saveDate()}
                                autoFocus
                                placeholder="YYYY.MM"
                                className="text-xs border border-indigo-300 rounded px-1 py-0.5 w-full max-w-[120px] focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-black !bg-white !text-black"
                            />
                         </div>
                    ) : (
                        <p className="text-xs text-slate-500 flex items-center gap-1 group/date mt-1 mb-2 h-6">
                            <CalendarIcon className="w-3 h-3 text-slate-400" />
                            <span className={!experience.activity_date ? "text-slate-400 italic" : ""}>
                                {experience.activity_date || "날짜 입력"}
                            </span>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingDate(true);
                                }}
                                className="p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-indigo-600 transition-colors ml-1"
                                aria-label="날짜 수정"
                                title="날짜 수정"
                            >
                                <PencilIcon className="w-3 h-3" />
                            </button>
                        </p>
                    )}
                </div>

                {experience.result_achievement && (
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 bg-slate-50 p-2 rounded">
                        {experience.result_achievement}
                    </p>
                )}
            </div>
        </div>
    );
};

const ExperienceListTab: React.FC<ExperienceListTabProps> = ({ experiences, onShowDetail, onDelete, onUpdate, onLoadMore, hasMore, loadingMore }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped');
    const [sortOrder, setSortOrder] = useState('date-desc');
    
    // State to track expanded categories in Grouped View
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    
    // Infinite Scroll Observer
    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loadingMore) return;
        if (observer.current) observer.current.disconnect();
        
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                onLoadMore();
            }
        });
        
        if (node) observer.current.observe(node);
    }, [loadingMore, hasMore, onLoadMore]);


    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupKey]: prev[groupKey] === false ? true : false // Toggle logic inverted because default is expanded
        }));
    };

    // NOTE: Filter OUT 'story' types to ensure this list only shows main Activity Shells (Basic Type)
    // This addresses the user request to keep Experience List strictly for Experience Cards (Pic 2)
    const allExperiences = useMemo(() => {
        return experiences.filter(exp => exp.type === 'basic' || !exp.type);
    }, [experiences]);

    const filteredExperiences = useMemo(() => {
        if (!searchQuery) return allExperiences;
        const lowerQuery = searchQuery.toLowerCase();
        return allExperiences.filter(exp => 
            (exp.activity_name || '').toLowerCase().includes(lowerQuery) ||
            (exp.detailed_content || '').toLowerCase().includes(lowerQuery)
        );
    }, [allExperiences, searchQuery]);

    // --- Logic for Grouped View ---
    const groupedData = useMemo(() => {
        const groups: Record<string, Record<string, Experience[]>> = {};

        filteredExperiences.forEach(exp => {
            let year = '연도 미상';
            const dateStr = exp.activity_date || '';

            // Check if ongoing/current
            if (dateStr.includes('현재') || dateStr.includes('진행중') || dateStr.toLowerCase().includes('present')) {
                 year = `${new Date().getFullYear()}년`;
            } else {
                // Extract YYYY from date string (e.g. 2024.03 or 2024.03~2025.02)
                const yearMatch = dateStr.match(/\d{4}/);
                if (yearMatch) {
                    year = `${yearMatch[0]}년`;
                }
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
            return b.localeCompare(a); // Descending e.g., 2025 -> 2024
        });
    }, [groupedData]);


    // --- Logic for Grid View (Sorted) ---
    const sortedGridExperiences = useMemo(() => {
        const list = [...filteredExperiences];
        list.sort((a, b) => {
            switch (sortOrder) {
                case 'date-desc':
                    return (b.activity_date || '').localeCompare(a.activity_date || '');
                case 'date-asc':
                    return (a.activity_date || '').localeCompare(b.activity_date || '');
                case 'created-desc':
                    return (b.createdAt || '').localeCompare(a.createdAt || '');
                case 'created-asc':
                    return (a.createdAt || '').localeCompare(b.createdAt || '');
                case 'name-asc':
                    return (a.activity_name || '').localeCompare(b.activity_name || '');
                case 'name-desc':
                    return (b.activity_name || '').localeCompare(a.activity_name || '');
                default:
                    return 0;
            }
        });
        return list;
    }, [filteredExperiences, sortOrder]);


    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header: Search + Toggle + Sort */}
            <div className="p-4 bg-white border-b border-slate-200 sticky top-0 z-10 space-y-3 shadow-sm">
                 <div className="relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="경험 검색 (활동명, 내용)..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 bg-slate-50 text-slate-900 transition-all"
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* View Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
                        <button
                            onClick={() => setViewMode('grouped')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2 rounded-md text-xs font-bold transition-all ${
                                viewMode === 'grouped' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'
                            }`}
                        >
                            <ListBulletIcon className="w-4 h-4" />
                            연도별 (그룹)
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1 px-4 py-2 rounded-md text-xs font-bold transition-all ${
                                viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'
                            }`}
                        >
                            <Squares2X2Icon className="w-4 h-4" />
                            전체 (그리드)
                        </button>
                    </div>

                    {/* Sort Dropdown (Visible in Grid View) */}
                    {viewMode === 'grid' && (
                        <div className="relative w-full sm:w-auto">
                            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="w-full sm:w-auto pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-indigo-500 text-slate-700 appearance-none cursor-pointer"
                            >
                                {SORT_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 scroll-smooth">
                {allExperiences.length === 0 && !loadingMore ? (
                    <div className="text-center py-20 text-slate-500">
                        <FolderIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">저장된 경험이 없습니다.</p>
                        <p className="text-sm mt-1">대화를 통해 새로운 경험을 추가해보세요.</p>
                    </div>
                ) : filteredExperiences.length === 0 && searchQuery ? (
                     <div className="text-center py-20 text-slate-500">
                        <SearchIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg">검색 결과가 없습니다.</p>
                    </div>
                ) : (
                    <>
                        {/* VIEW MODE: GROUPED */}
                        {viewMode === 'grouped' && sortedYears.map(year => (
                            <div key={year} className="animate-fade-in-up">
                                <div className="flex items-center gap-4 mb-4 sticky top-0 bg-slate-50/95 backdrop-blur-sm py-2 z-10">
                                    <h2 className="text-2xl font-extrabold text-slate-800">{year}</h2>
                                    <div className="h-0.5 flex-1 bg-slate-200 rounded-full"></div>
                                </div>

                                <div className="space-y-4">
                                    {Object.keys(groupedData[year]).sort().map(category => {
                                        const groupKey = `${year}-${category}`;
                                        // CHANGED: Default to expanded if undefined. Only collapse if specifically false.
                                        const isExpanded = expandedGroups[groupKey] !== false;
                                        const items = groupedData[year][category];

                                        return (
                                            <div key={groupKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-100">
                                                <button 
                                                    onClick={() => toggleGroup(groupKey)}
                                                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            <BoxIcon className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-700 text-lg">{category}</h3>
                                                            <p className="text-xs text-slate-400 font-medium">{items.length}개의 활동</p>
                                                        </div>
                                                    </div>
                                                    <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                        <ChevronDownIcon className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <div className="p-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                                            {items.map(exp => (
                                                                <ExperienceCard 
                                                                    key={exp.id} 
                                                                    experience={exp} 
                                                                    onShowDetail={onShowDetail} 
                                                                    onUpdate={onUpdate}
                                                                    onDelete={onDelete} 
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

                        {/* VIEW MODE: GRID (SORTED) */}
                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
                                {sortedGridExperiences.map(exp => (
                                    <ExperienceCard 
                                        key={exp.id} 
                                        experience={exp} 
                                        onShowDetail={onShowDetail} 
                                        onUpdate={onUpdate}
                                        onDelete={onDelete} 
                                    />
                                ))}
                            </div>
                        )}
                        
                        {/* Infinite Scroll Sentinel */}
                        <div ref={lastElementRef} className="h-20 flex items-center justify-center">
                            {loadingMore && <LoadingSpinner isWhite={false} />}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ExperienceListTab;
