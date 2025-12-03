
import React, { useEffect, useState } from 'react';
import { SparklesIcon, StarIcon } from './icons';

interface LevelUpModalProps {
    level: number;
    levelName: string;
    onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ level, levelName, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger animation on mount
        setIsVisible(true);
        // Auto close logic handled by parent
        return () => setIsVisible(false);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-500">
            <div 
                className={`relative flex flex-col items-center justify-center text-center p-12 transform transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-20'}`}
            >
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/40 to-purple-500/40 blur-[80px] rounded-full pointer-events-none animate-pulse"></div>
                
                {/* Confetti / Decorations */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                     {[...Array(20)].map((_, i) => (
                        <div 
                            key={i}
                            className="absolute w-2 h-2 rounded-full animate-[rain_3s_infinite_ease-in-out]"
                            style={{
                                backgroundColor: ['#FFD700', '#FF69B4', '#00BFFF', '#32CD32'][i % 4],
                                left: `${Math.random() * 100}%`,
                                top: `-10px`,
                                animationDelay: `${Math.random() * 2}s`,
                                animationDuration: `${2 + Math.random() * 2}s`
                            }}
                        />
                     ))}
                </div>

                {/* Animated Stars */}
                <div className="absolute -top-12 -left-12 animate-[bounce_2s_infinite]">
                    <StarIcon className="w-20 h-20 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]" />
                </div>
                <div className="absolute -bottom-12 -right-12 animate-[bounce_2.5s_infinite] delay-100">
                    <StarIcon className="w-16 h-16 text-pink-400 drop-shadow-[0_0_20px_rgba(244,114,182,0.8)]" />
                </div>
                <div className="absolute top-1/2 -left-20 animate-ping opacity-75">
                    <SparklesIcon className="w-10 h-10 text-cyan-400" />
                </div>
                <div className="absolute top-0 right-0 animate-spin-slow opacity-80">
                    <SparklesIcon className="w-12 h-12 text-white" />
                </div>

                {/* Main Content Card */}
                <div className="relative z-10 bg-white/20 border border-white/40 p-12 rounded-[2rem] shadow-2xl backdrop-blur-xl overflow-hidden min-w-[350px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5"></div>
                    
                    <div className="relative z-20 flex flex-col items-center">
                        <div className="text-8xl mb-6 animate-[wiggle_1s_ease-in-out_infinite]">
                            🎉
                        </div>
                        <h2 className="text-5xl font-black text-white mb-2 drop-shadow-lg tracking-tight italic">
                            LEVEL UP!
                        </h2>
                        <div className="my-6 transform scale-125">
                            <span className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-200 to-yellow-300 drop-shadow-sm filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                                Lv.{level}
                            </span>
                        </div>
                        <div className="bg-black/30 backdrop-blur-md px-6 py-2 rounded-full mb-6 border border-white/20">
                             <h3 className="text-2xl font-bold text-white tracking-wide">
                                {levelName}
                            </h3>
                        </div>
                        <p className="text-indigo-50 font-medium text-lg leading-relaxed">
                            축하해요! 우리 사이가 더 가까워졌어요.<br/>
                            앞으로의 여정도 함께해요!
                        </p>
                    </div>
                </div>
            </div>
            
            <style>{`
                @keyframes rain {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default LevelUpModal;
