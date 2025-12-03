
import React from 'react';
import { DatabaseIcon, ChatIcon, BookOpenIcon } from './icons';
import { PanelType } from '../types';

interface AppNavigatorProps {
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
  isOnboarding: boolean;
}

const NavButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
}> = ({ label, isActive, onClick, icon, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`flex flex-col items-center justify-center flex-1 py-2 transition-all duration-300 ease-in-out relative ${
            disabled ? 'opacity-30 cursor-not-allowed text-slate-300' : 
            isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-500'
        }`}
    >
        <div className="relative">
            {isActive && !disabled && <span className="absolute -inset-2.5 bg-indigo-100 rounded-full -z-10"></span>}
            {icon}
        </div>
        <span className="text-xs font-bold mt-1">{label}</span>
    </button>
);

const AppNavigator: React.FC<AppNavigatorProps> = ({ activePanel, setActivePanel, isOnboarding }) => {
  return (
    <nav className="flex bg-white/80 backdrop-blur-sm border-t border-slate-200 flex-shrink-0 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] relative z-50 w-full mx-auto">
      
      <NavButton
        label="데이터 목록"
        isActive={activePanel === 'data'}
        onClick={() => !isOnboarding && setActivePanel('data')}
        icon={<DatabaseIcon className="w-6 h-6" />}
        disabled={isOnboarding}
      />

      <NavButton
        label="경험 입력"
        isActive={activePanel === 'chat'}
        onClick={() => setActivePanel('chat')}
        icon={<ChatIcon className="w-6 h-6" />}
      />

      <NavButton
        label="개인 아카이브"
        isActive={activePanel === 'report'}
        onClick={() => !isOnboarding && setActivePanel('report')}
        icon={<BookOpenIcon className="w-6 h-6" />}
        disabled={isOnboarding}
      />
    </nav>
  );
};

export default AppNavigator;
