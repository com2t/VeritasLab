
import React from 'react';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAgree: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose, onAgree }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-800">개인정보 제공 및 활용 동의</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 text-slate-700">
                    <p className="font-semibold">경험스택(이하 ‘회사’)은 「개인정보 보호법」 등 관련 법령에 따라 회원의 개인정보를 안전하게 관리합니다. 서비스 이용을 위해 다음과 같이 개인정보를 수집·이용합니다.</p>
                    
                    <div>
                        <h3 className="font-bold text-lg mb-2">1. 수집 항목</h3>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li><strong className="font-semibold">필수:</strong> 성명, 성별, 생년월일, 학교, 학과, 전화번호, 비밀번호</li>
                            <li><strong className="font-semibold">선택:</strong> 관심 직무</li>
                        </ul>
                    </div>
                    
                    <div>
                        <h3 className="font-bold text-lg mb-2">2. 이용 목적</h3>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li>회원가입 및 본인확인</li>
                            <li>개인화된 경험 기록 및 AI 기반 추천 제공</li>
                            <li>서비스 이용 통계, 분석 및 개선</li>
                            <li>공지사항 및 알림 전달</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg mb-2">3. 보유 및 이용 기간</h3>
                        <ul className="list-disc list-inside space-y-1 pl-2">
                            <li>회원 탈퇴 시 즉시 파기</li>
                            <li>단, 관련 법령에 따라 일정 기간 보존할 수 있음 (예: 소비자 불만 처리 등 3년)</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-bold text-lg mb-2">4. 동의 거부권 안내</h3>
                        <p>동의를 거부할 수 있으나, 필수항목 미동의 시 회원가입 및 서비스 이용이 제한될 수 있습니다.</p>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-4 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors">
                        닫기
                    </button>
                    <button onClick={onAgree} className="px-6 py-2 text-sm font-bold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 transition-colors">
                        동의
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyModal;