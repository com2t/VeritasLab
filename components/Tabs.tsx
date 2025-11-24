import React from 'react';
import { TabType } from '../types';
import { ChatIcon, FolderIcon, BoxIcon, ChartPieIcon } from './icons';

interface TabsProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
}

const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
}> = ({ label, isActive, onClick, icon }) => (
    <button
        onClick={onClick}
        className={`tab flex-1 p-4 text-center border-b-2 font-semibold transition-all duration-300 ease-in-out flex items-center justify-center gap-2 ${
            isActive
                ? 'text-indigo-500 border-indigo-500 bg-white'
                : 'text-gray-500 border-transparent hover:bg-gray-100 hover:text-gray-700'
        }`}
    >
        {icon}
        {label}
    </button>
);

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab }) => {
    return (
        <div className="tabs flex bg-gray-50 border-b-2 border-gray-200 flex-shrink-0">
            <TabButton
                label="경험 입력"
                isActive={activeTab === 'chat'}
                onClick={() => setActiveTab('chat')}
                icon={<ChatIcon className="w-5 h-5" />}
            />
            <TabButton
                label="경험 목록"
                isActive={activeTab === 'list'}
                onClick={() => setActiveTab('list')}
                icon={<FolderIcon className="w-5 h-5" />}
            />
            <TabButton
                label="스토리 상자"
                isActive={activeTab === 'story'}
                onClick={() => setActiveTab('story')}
                icon={<BoxIcon className="w-5 h-5" />}
            />
            <TabButton
                label="개인 리포트"
                isActive={activeTab === 'report'}
                onClick={() => setActiveTab('report')}
                icon={<ChartPieIcon className="w-5 h-5" />}
            />
        </div>
    );
};

export default Tabs;