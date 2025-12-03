
import React from 'react';
import { Experience } from '../types';
import ExperienceListTab from './ExperienceListTab';
import StoryBoxTab from './StoryBoxTab';

interface DataViewsPanelProps {
  experiences: Experience[];
  onShowDetail: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Experience>) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  activeDataView: 'list' | 'story';
  setActiveDataView: (view: 'list' | 'story') => void;
  highlightedStoryId: string | null;
  clearHighlightedStory: () => void;
}

const DataViewsPanel: React.FC<DataViewsPanelProps> = (props) => {
  const { activeDataView, setActiveDataView } = props;

  const getIndicatorPosition = () => {
    if (activeDataView === 'list') return '0%';
    return '100%';
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-slate-200 flex-shrink-0 flex items-center justify-center sticky top-0 z-20">
        <div className="relative flex bg-slate-200 p-1 rounded-full text-sm font-semibold">
          <span
            className={`absolute top-1 bottom-1 left-1 w-1/2 bg-white rounded-full shadow-md transition-transform duration-300 ease-in-out`}
            style={{ transform: `translateX(${getIndicatorPosition()})` }}
          ></span>
          <button
            onClick={() => setActiveDataView('list')}
            className={`relative z-10 w-32 py-1.5 transition-colors ${activeDataView === 'list' ? 'text-indigo-600' : 'text-slate-600'}`}
          >
            📂 목록
          </button>
          <button
            onClick={() => setActiveDataView('story')}
            className={`relative z-10 w-32 py-1.5 transition-colors ${activeDataView === 'story' ? 'text-indigo-600' : 'text-slate-600'}`}
          >
            📦 스토리
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeDataView === 'list' && <ExperienceListTab {...props} />}
        {activeDataView === 'story' && <StoryBoxTab {...props} />}
      </div>
    </div>
  );
};

export default DataViewsPanel;
