
import React, { useState, useMemo } from 'react';
import { Experience } from '../types';
import { FolderIcon, TrashIcon, SearchIcon, LoadingSpinner } from './icons';

interface ExperienceListTabProps {
    experiences: Experience[];
    onShowDetail: (id: string) => void;
    onDelete: (id: string) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    loadingMore: boolean;
}

type SortOrder = 'date-desc' | 'date-asc' | 'created-desc' | 'created-asc' | 'name-asc' | 'name-desc';

const SORT_OPTIONS: { value: SortOrder, label: string }[] = [
    { value: 'date-desc', label: '최신 경험순' },
    { value: 'date-asc', label: '오래된 경험순' },
    { value: 'created-desc', label: '최근 생성순' },
    { value: 'created-asc', label: '오래된 생성순' },
    { value: 'name-asc', label: '이름 오름차순' },
    { value: 'name-desc', label: '이름 내림차순' },
];

const ExperienceCard: React.FC<{ experience: Experience; onShowDetail: (id: string) => void; onDelete: (id: string) => void; }> = ({ experience, onShowDetail, onDelete }) => {
    const formatDate = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return '날짜 정보 없음';
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200 group transition-all hover:shadow-md hover:border-indigo-300 h-full flex flex-col">
            <div className="flex justify-between items-start flex-1">
                <div className="flex-1 cursor-pointer" onClick={() => onShowDetail(experience.id)}>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-md">
                            {experience.activity_type || '미분류'}
                        </span>
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">{experience.activity_name}</h3>
                    <div className="text-sm text-slate-500 mt-2 space-y-1">
                        <p><span className="font-semibold w-16 inline-block">활동일자:</span> {experience.activity_date}</p>
                        <p><span className="font-semibold w-16 inline-block">생성일자:</span> {formatDate(experience.createdAt)}</p>
                    </div>
                </div>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(experience.id); }} 
                    className="p-2 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2"
                    aria-label="삭제"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

const ExperienceListTab: React.FC<ExperienceListTabProps> = ({ experiences, onShowDetail, onDelete, onLoadMore, hasMore, loadingMore }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<SortOrder>('created-desc');
    
    const basicExperiences = useMemo(() => {
        const sorted = [...experiences.filter(exp => exp.type === 'basic')].sort((a, b) => {
            try {
                switch (sortOrder) {
                    case 'date-desc':
                        return new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime();
                    case 'date-asc':
                        return new Date(a.activity_date).getTime() - new Date(b.activity_date).getTime();
                    case 'created-asc':
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    case 'name-asc':
                        return a.activity_name.localeCompare(b.activity_name);
                    case 'name-desc':
                        return b.activity_name.localeCompare(a.activity_name);
                    case 'created-desc':
                    default:
                         return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                }
            } catch(e) {
                // Fallback for invalid date strings
                return b.sequence_number - a.sequence_number;
            }
        });
        return sorted;
    }, [experiences, sortOrder]);

    const filteredExperiences = useMemo(() => {
        if (!searchQuery) return basicExperiences;
        return basicExperiences.filter(exp => 
            exp.activity_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            exp.detailed_content.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [basicExperiences, searchQuery]);


    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="p-4 space-y-4 border-b border-slate-200 bg-white">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="경험 검색..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-slate-100 text-slate-900"
                        />
                    </div>
                     <div className="flex-shrink-0">
                        <select
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as SortOrder)}
                            className="w-full sm:w-auto h-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-white text-slate-700"
                        >
                            {SORT_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                 </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                {basicExperiences.length === 0 && !loadingMore ? (
                    <div className="text-center py-20 text-slate-500">
                        <FolderIcon className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-lg">저장된 경험이 없습니다.</p>
                        <p className="text-sm mt-1">경험 입력 탭에서 새로운 경험을 추가해보세요.</p>
                    </div>
                ) : filteredExperiences.length === 0 && searchQuery ? (
                     <div className="text-center py-20 text-slate-500">
                        <SearchIcon className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-lg">검색 결과가 없습니다.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                        {filteredExperiences.map(exp => (
                            <ExperienceCard key={exp.id} experience={exp} onShowDetail={onShowDetail} onDelete={onDelete} />
                        ))}
                    </div>
                )}
                 {hasMore && (
                    <div className="text-center mt-8 pb-4">
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

export default ExperienceListTab;
