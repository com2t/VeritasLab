
import React from 'react';
import { JobFitAnalysis } from '../types';
import { CheckIcon, ArrowTrendingUpIcon, StarIcon, LightBulbIcon } from './icons';

interface JobFitAnalysisViewProps {
    data: JobFitAnalysis;
}

const JobFitAnalysisView: React.FC<JobFitAnalysisViewProps> = ({ data }) => {
    // Helper to calculate polygon points for radar chart
    const calculatePolygonPoints = (dataPoints: number[], max: number, radius: number, center: number) => {
        const total = dataPoints.length;
        return dataPoints.map((value, i) => {
            const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
            const x = center + (radius * (value / max)) * Math.cos(angle);
            const y = center + (radius * (value / max)) * Math.sin(angle);
            return `${x},${y}`;
        }).join(' ');
    };

    const size = 300;
    const center = size / 2;
    const radius = size / 2 - 40;
    const maxScore = 100;

    const myScores = data.radarChart.map(d => d.myScore);
    const avgScores = data.radarChart.map(d => d.avgScore);
    const axes = data.radarChart.map(d => d.axis);

    const myPoints = calculatePolygonPoints(myScores, maxScore, radius, center);
    const avgPoints = calculatePolygonPoints(avgScores, maxScore, radius, center);
    const bgPoints = calculatePolygonPoints(new Array(axes.length).fill(100), maxScore, radius, center);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden my-4 w-full">
            {/* Header */}
            <div className="bg-indigo-600 p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                    <StarIcon className="w-48 h-48" />
                </div>
                <div className="relative z-10">
                    <h2 className="text-sm font-semibold uppercase tracking-wider opacity-80 mb-1">직무 적합도 분석</h2>
                    <h1 className="text-3xl font-bold mb-2">{data.targetJob}</h1>
                    <div className="flex items-end gap-2">
                        <span className="text-5xl font-extrabold">{data.fitScore}</span>
                        <span className="text-xl mb-1 opacity-80">/ 100점</span>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-8">
                {/* Summary */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <p className="text-slate-700 leading-relaxed font-medium">
                        {data.summary}
                    </p>
                </div>

                {/* Radar Chart */}
                <div className="flex flex-col items-center">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <ArrowTrendingUpIcon className="w-5 h-5 text-indigo-500" />
                        역량 비교 분석
                    </h3>
                    <div className="relative">
                        <svg width={size} height={size} className="transform rotate-0">
                            {/* Background Polygon (100%) */}
                            <polygon points={bgPoints} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                            {/* Grid Lines (25%, 50%, 75%) */}
                            {[0.25, 0.5, 0.75].map(scale => (
                                <polygon 
                                    key={scale}
                                    points={calculatePolygonPoints(new Array(axes.length).fill(100 * scale), maxScore, radius, center)} 
                                    fill="none" 
                                    stroke="#e2e8f0" 
                                    strokeDasharray="4 4" 
                                />
                            ))}
                            {/* Axes */}
                            {axes.map((axis, i) => {
                                const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
                                const x = center + radius * Math.cos(angle);
                                const y = center + radius * Math.sin(angle);
                                return (
                                    <g key={i}>
                                        <line x1={center} y1={center} x2={x} y2={y} stroke="#cbd5e1" />
                                        <text 
                                            x={x * 1.15 - center * 0.15} 
                                            y={y * 1.15 - center * 0.15} 
                                            textAnchor="middle" 
                                            dominantBaseline="middle"
                                            className="text-xs font-semibold fill-slate-600"
                                            fontSize="11"
                                        >
                                            {axis}
                                        </text>
                                    </g>
                                );
                            })}
                            
                            {/* Avg Score Polygon */}
                            <polygon points={avgPoints} fill="rgba(148, 163, 184, 0.2)" stroke="#94a3b8" strokeWidth="2" />
                            
                            {/* My Score Polygon */}
                            <polygon points={myPoints} fill="rgba(79, 70, 229, 0.4)" stroke="#4f46e5" strokeWidth="2" />
                        </svg>
                        <div className="flex justify-center gap-6 mt-4 text-xs font-semibold">
                             <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-indigo-500 opacity-60 rounded-full"></div>
                                <span className="text-indigo-700">나의 점수</span>
                             </div>
                             <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-slate-400 opacity-40 rounded-full"></div>
                                <span className="text-slate-500">평균 점수</span>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Strong Skills */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <StarIcon className="w-5 h-5 text-amber-500" />
                            나의 강점 (Top 3)
                        </h3>
                        <div className="space-y-2">
                            {data.topStrongSkills.map((skill, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                    <span className="text-sm font-semibold text-indigo-700">{skill}</span>
                                    <div className="flex text-amber-400">
                                        {[...Array(3)].map((_, idx) => (
                                            <StarIcon key={idx} className="w-3 h-3 fill-current" />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Weak Skills & Actions */}
                    <div className="space-y-3">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <LightBulbIcon className="w-5 h-5 text-indigo-500" />
                            보완이 필요한 점
                        </h3>
                        <div className="space-y-4">
                            {data.weakSkills.map((item, i) => (
                                <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <h4 className="text-sm font-bold text-slate-700 mb-2">{item.skill}</h4>
                                    <ul className="space-y-1">
                                        {item.toDo.map((todo, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                                                <CheckIcon className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                                                {todo}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Key Experiences */}
                <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">기여한 핵심 경험</h3>
                    <div className="flex flex-wrap gap-2">
                        {data.keyExperiences.map((exp, i) => (
                            <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm">
                                🏆 {exp}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-50 p-3 text-center border-t border-slate-200">
                <p className="text-xs text-slate-500">
                    전체 직무 중 적합도 순위: <span className="font-bold text-indigo-600">{data.rank}위</span> / 15개 직무
                </p>
            </div>
        </div>
    );
};

export default JobFitAnalysisView;
