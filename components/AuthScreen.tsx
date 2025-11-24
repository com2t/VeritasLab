import React, { useState } from 'react';
import { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, setDoc, doc, db, updateProfile, sendPasswordResetEmail } from '../firebase';
import { UserProfile } from '../types';
import { SparklesIcon, UserIcon, LockClosedIcon, DevicePhoneMobileIcon, IdentificationIcon, AcademicCapIcon, BriefcaseIcon, EyeIcon, EyeSlashIcon, LoadingSpinner } from './icons';
import PrivacyPolicyModal from './PrivacyPolicyModal';

const formatPhoneNumber = (value: string): string => {
    if (!value) return value;
    // 1. Remove non-digit characters and limit to 11 digits.
    const phoneNumber = value.replace(/\D/g, '').slice(0, 11);
    const phoneNumberLength = phoneNumber.length;

    // 2. Apply formatting based on length (e.g., 010-1234-5678).
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 8) {
        return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
    }
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7)}`;
};

const AuthScreen: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [isResetView, setIsResetView] = useState(false);

    const renderContent = () => {
        if (isResetView) {
            return (
                <>
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 mx-auto bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-500">
                            <LockClosedIcon className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">비밀번호 재설정</h1>
                        <p className="text-gray-500">
                            가입하신 전화번호를 입력하시면<br/>재설정 링크를 이메일로 보내드립니다.
                        </p>
                    </div>
                    <ResetPasswordForm onBack={() => setIsResetView(false)} />
                </>
            );
        }

        return (
            <>
                <div className="text-center mb-8">
                    <SparklesIcon className="w-12 h-12 mx-auto text-indigo-500 mb-4" />
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">경험 스택</h1>
                    <p className="text-gray-500">
                        {isLoginView ? 'AI 코치와 함께 당신의 경험을 자산으로 만드세요.' : '몇 가지 정보만 입력하면 바로 시작할 수 있어요.'}
                    </p>
                </div>
                
                {isLoginView ? (
                    <LoginForm onForgotPassword={() => setIsResetView(true)} />
                ) : (
                    <SignupForm />
                )}

                <div className="mt-6 text-center">
                    <button onClick={() => setIsLoginView(!isLoginView)} className="text-sm font-semibold text-indigo-500 hover:text-indigo-700">
                        {isLoginView ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
                    </button>
                </div>
            </>
        );
    };

    return (
        <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-2xl animate-fade-in-up transition-all duration-300">
                {renderContent()}
            </div>
        </div>
    );
};

const InputField: React.FC<{ id: string, type: string, placeholder: string, value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, icon: React.ReactNode, required?: boolean, onToggleVisibility?: () => void, showPassword?: boolean }> = 
({ id, type, placeholder, value, onChange, icon, required = true, onToggleVisibility, showPassword }) => {
    const isDateInput = type === 'date';

    // For date inputs, we want to show a placeholder. The standard way to do this is
    // to render it as a 'text' input when empty, and switch to 'date' on focus or when it has a value.
    const displayType = isDateInput && !value ? 'text' : type;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (isDateInput) {
            e.target.type = 'date';
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (isDateInput && !e.target.value) {
            e.target.type = 'text';
        }
    };
    
    return (
        <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                {icon}
            </span>
            <input
                id={id}
                name={id}
                type={displayType}
                value={value}
                onChange={onChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={placeholder}
                required={required}
                className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 bg-slate-50 text-slate-900"
            />
            {onToggleVisibility && (
                 <button type="button" onClick={onToggleVisibility} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700">
                    {showPassword ? <EyeSlashIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
            )}
        </div>
    );
};

interface LoginFormProps {
    onForgotPassword: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const email = `${phoneNumber.replace(/\D/g, '')}@expstack.com`;
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            const error = err as any;
            if (error.code) {
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        setError('전화번호 또는 비밀번호가 올바르지 않습니다.');
                        break;
                    default:
                        setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
                        break;
                }
            } else {
                setError('알 수 없는 오류가 발생했습니다.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <form onSubmit={handleLogin} className="space-y-4">
             <InputField 
                id="phoneNumber"
                type="tel"
                placeholder="전화번호"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                icon={<DevicePhoneMobileIcon className="w-5 h-5" />}
            />
            <div>
                <InputField 
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    icon={<LockClosedIcon className="w-5 h-5" />}
                    onToggleVisibility={() => setShowPassword(!showPassword)}
                    showPassword={showPassword}
                />
                <div className="flex justify-end mt-2">
                    <button 
                        type="button"
                        onClick={onForgotPassword}
                        className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                    >
                        비밀번호를 잊으셨나요?
                    </button>
                </div>
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center py-3 px-4 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors disabled:bg-indigo-300">
                {isLoading ? <LoadingSpinner /> : '로그인'}
            </button>
        </form>
    )
}

interface ResetPasswordFormProps {
    onBack: () => void;
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ onBack }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            const email = `${phoneNumber.replace(/\D/g, '')}@expstack.com`;
            await sendPasswordResetEmail(auth, email);
            setMessage({
                type: 'success',
                text: '비밀번호 재설정 링크가 전송되었습니다. (실제 이메일이 유효하지 않은 경우 링크를 받을 수 없습니다.)'
            });
        } catch (err) {
            const error = err as any;
            if (error.code) {
                if (error.code === 'auth/user-not-found') {
                    setMessage({ type: 'error', text: '가입되지 않은 전화번호입니다.' });
                } else if (error.code === 'auth/invalid-email') {
                    setMessage({ type: 'error', text: '전화번호 형식이 올바르지 않습니다.' });
                } else {
                    setMessage({ type: 'error', text: '요청을 처리하는 중 오류가 발생했습니다.' });
                }
            } else {
                setMessage({ type: 'error', text: '알 수 없는 오류가 발생했습니다.' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {message && message.type === 'success' ? (
                <div className="text-center space-y-6 animate-fade-in">
                    <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm">
                        {message.text}
                    </div>
                    <button 
                        onClick={onBack}
                        className="w-full py-3 px-4 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 transition-colors"
                    >
                        로그인으로 돌아가기
                    </button>
                </div>
            ) : (
                <form onSubmit={handleReset} className="space-y-4">
                    <InputField 
                        id="resetPhoneNumber"
                        type="tel"
                        placeholder="전화번호"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                        icon={<DevicePhoneMobileIcon className="w-5 h-5" />}
                    />
                    
                    {message && message.type === 'error' && (
                        <p className="text-sm text-red-500 text-center">{message.text}</p>
                    )}

                    <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center py-3 px-4 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors disabled:bg-indigo-300">
                        {isLoading ? <LoadingSpinner /> : '재설정 링크 보내기'}
                    </button>

                    <button 
                        type="button"
                        onClick={onBack}
                        className="w-full flex items-center justify-center py-3 px-4 bg-white text-slate-600 border-2 border-slate-200 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                    >
                        취소
                    </button>
                </form>
            )}
        </div>
    );
};

const PasswordRequirement: React.FC<{ label: string, satisfied: boolean }> = ({ label, satisfied }) => (
    <div className={`flex items-center gap-2 text-xs transition-colors ${satisfied ? 'text-emerald-500' : 'text-slate-500'}`}>
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={satisfied ? "M4.5 12.75l6 6 9-13.5" : "M6 18L18 6M6 6l12 12"} />
        </svg>
        <span>{label}</span>
    </div>
);

const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
    const checks = [
        { label: '8자 이상', satisfied: password.length >= 8 },
        { label: '영문자 포함', satisfied: /[a-zA-Z]/.test(password) },
        { label: '특수기호 포함', satisfied: /[^a-zA-Z0-9]/.test(password) },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 -mt-2 mb-2 px-1">
            {checks.map((check) => (
                <PasswordRequirement key={check.label} label={check.label} satisfied={check.satisfied} />
            ))}
        </div>
    );
};

const SignupForm = () => {
    const [formData, setFormData] = useState({
        name: '', gender: 'male', dateOfBirth: '', school: '', major: '',
        phoneNumber: '', interestedJob: '', password: '', confirmPassword: '',
    });
    const [privacyConsent, setPrivacyConsent] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const validatePassword = (password: string) => {
        if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.';
        if (!/[a-zA-Z]/.test(password)) return '비밀번호에 영문자를 포함해야 합니다.';
        if (!/[^a-zA-Z0-9]/.test(password)) return '비밀번호에 특수기호를 포함해야 합니다.';
        return '';
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const finalValue = name === 'phoneNumber' ? formatPhoneNumber(value) : value;
        setFormData({ ...formData, [name]: finalValue });
    };

    const handleAgree = () => {
        setPrivacyConsent(true);
        setIsModalOpen(false);
        if (error === '개인정보 제공 및 활용에 동의해야 합니다.') {
            setError('');
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const passwordError = validatePassword(formData.password);
        if (passwordError) {
            setError(passwordError);
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }
        if (!privacyConsent) {
            setError('개인정보 제공 및 활용에 동의해야 합니다.');
            return;
        }

        setIsLoading(true);
        try {
            const email = `${formData.phoneNumber.replace(/\D/g, '')}@expstack.com`;
            const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
            const user = userCredential.user;
            
            await updateProfile(user, { displayName: formData.name });
            
            const userProfile: UserProfile = {
                uid: user.uid,
                name: formData.name,
                gender: formData.gender as 'male' | 'female',
                dateOfBirth: formData.dateOfBirth,
                school: formData.school,
                major: formData.major,
                phoneNumber: formData.phoneNumber,
                interestedJob: formData.interestedJob || '없음',
                isOnboardingFinished: false, // Force Onboarding for new users
            };

            await setDoc(doc(db, "users", user.uid), userProfile);
            // Removed addExampleData to start with clean data

        } catch (err) {
            const error = err as any;
            if (error.code) {
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        setError('이미 가입된 전화번호입니다.');
                        break;
                    case 'auth/invalid-email':
                        setError('전화번호 형식이 올바르지 않습니다. (예: 01012345678)');
                        break;
                    case 'auth/weak-password':
                        setError('비밀번호가 너무 약합니다. 6자 이상으로 설정해주세요.');
                        break;
                    default:
                        setError('회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
                        break;
                }
            } else {
                setError('알 수 없는 오류가 발생했습니다.');
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                     <InputField id="name" type="text" placeholder="성명" value={formData.name} onChange={handleChange} icon={<UserIcon className="w-5 h-5"/>} />
                    <div className="flex items-center justify-around border-2 border-slate-200 rounded-lg bg-slate-50">
                        <label className="flex items-center gap-2 cursor-pointer p-3">
                            <input type="radio" name="gender" value="male" checked={formData.gender === 'male'} onChange={handleChange} className="form-radio text-indigo-500"/>
                            <span className="text-sm text-slate-700">남성</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-3">
                            <input type="radio" name="gender" value="female" checked={formData.gender === 'female'} onChange={handleChange} className="form-radio text-indigo-500"/>
                             <span className="text-sm text-slate-700">여성</span>
                        </label>
                    </div>
                </div>
                <InputField id="dateOfBirth" type="date" placeholder="생년월일" value={formData.dateOfBirth} onChange={handleChange} icon={<IdentificationIcon className="w-5 h-5"/>} />
                <InputField id="school" type="text" placeholder="학교" value={formData.school} onChange={handleChange} icon={<AcademicCapIcon className="w-5 h-5"/>} />
                <InputField id="major" type="text" placeholder="학과" value={formData.major} onChange={handleChange} icon={<AcademicCapIcon className="w-5 h-5"/>} />
                <InputField id="phoneNumber" type="tel" placeholder="전화번호" value={formData.phoneNumber} onChange={handleChange} icon={<DevicePhoneMobileIcon className="w-5 h-5"/>} />
                <InputField id="interestedJob" type="text" placeholder="관심 직무 (없으면 비워두세요)" value={formData.interestedJob} onChange={handleChange} icon={<BriefcaseIcon className="w-5 h-5"/>} required={false} />
                 <InputField 
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="비밀번호"
                    value={formData.password}
                    onChange={handleChange}
                    icon={<LockClosedIcon className="w-5 h-5" />}
                    onToggleVisibility={() => setShowPassword(!showPassword)}
                    showPassword={showPassword}
                />
                <PasswordStrengthMeter password={formData.password} />
                <InputField 
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="비밀번호 확인"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    icon={<LockClosedIcon className="w-5 h-5" />}
                    onToggleVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
                    showPassword={showConfirmPassword}
                />
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="privacy" checked={privacyConsent} readOnly className="form-checkbox h-4 w-4 text-indigo-600 rounded" />
                    <label htmlFor="privacy" className="text-sm text-slate-600">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(true)}
                            className="underline hover:text-indigo-500 transition-colors"
                        >
                            개인정보 제공 및 활용
                        </button>
                        에 동의합니다.
                    </label>
                </div>
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                 <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center py-3 px-4 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition-colors disabled:bg-indigo-300">
                    {isLoading ? <LoadingSpinner /> : '회원가입'}
                </button>
            </form>
            <PrivacyPolicyModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAgree={handleAgree}
            />
        </>
    );
};

export default AuthScreen;