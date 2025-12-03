
import { Experience } from './types';

export interface JobDefinition {
    jobId: string;
    nameKo: string;
    nameEn: string;
}

export interface SkillDefinition {
    skillId: string;
    nameKo: string;
    nameEn: string;
    category: string;
}

export interface JobSkillMapping {
    jobId: string;
    skillId: string;
    weight: number; // 1~5
    type: "core" | "plus";
}

export interface JobScore {
    jobId: string;
    score: number; // 0~100
    coreRatio: number;
    plusRatio: number;
}

// 1. 직무 목록 (15개)
export const JOBS: JobDefinition[] = [
    { jobId: "JOB001", nameKo: "경영·기획", nameEn: "Business & Strategy" },
    { jobId: "JOB002", nameKo: "마케팅", nameEn: "Marketing" },
    { jobId: "JOB003", nameKo: "영업·BD", nameEn: "Sales & Business Development" },
    { jobId: "JOB004", nameKo: "고객지원·운영", nameEn: "Customer Support & Operations" },
    { jobId: "JOB005", nameKo: "프로젝트/프로덕트 매니지먼트", nameEn: "Project/Product Management" },
    { jobId: "JOB006", nameKo: "데이터 분석", nameEn: "Data Analysis" },
    { jobId: "JOB007", nameKo: "소프트웨어 개발", nameEn: "Software Engineering" },
    { jobId: "JOB008", nameKo: "디자인(UI/UX·그래픽)", nameEn: "Design (UI/UX & Graphic)" },
    { jobId: "JOB009", nameKo: "인사·HR", nameEn: "Human Resources" },
    { jobId: "JOB010", nameKo: "재무·회계", nameEn: "Finance & Accounting" },
    { jobId: "JOB011", nameKo: "SCM·물류", nameEn: "Supply Chain & Logistics" },
    { jobId: "JOB012", nameKo: "생산·품질", nameEn: "Production & Quality" },
    { jobId: "JOB013", nameKo: "공공·사회가치·교육", nameEn: "Public, Social & Education" },
    { jobId: "JOB014", nameKo: "연구개발(R&D)", nameEn: "Research & Development" },
    { jobId: "JOB015", nameKo: "글로벌/해외사업", nameEn: "Global & Overseas Business" }
];

// 2. 역량 목록 (200개)
export const SKILLS: SkillDefinition[] = [
    // 공통역량 (COM) 40개
    { skillId: "COM001", nameKo: "문제해결", nameEn: "Problem Solving", category: "COM" },
    { skillId: "COM002", nameKo: "분석적 사고", nameEn: "Analytical Thinking", category: "COM" },
    { skillId: "COM003", nameKo: "비판적 사고", nameEn: "Critical Thinking", category: "COM" },
    { skillId: "COM004", nameKo: "창의력", nameEn: "Creativity", category: "COM" },
    { skillId: "COM005", nameKo: "의사소통", nameEn: "Communication", category: "COM" },
    { skillId: "COM006", nameKo: "대인관계", nameEn: "Interpersonal Skills", category: "COM" },
    { skillId: "COM007", nameKo: "협업", nameEn: "Teamwork & Collaboration", category: "COM" },
    { skillId: "COM008", nameKo: "리더십", nameEn: "Leadership", category: "COM" },
    { skillId: "COM009", nameKo: "주도성", nameEn: "Proactiveness", category: "COM" },
    { skillId: "COM010", nameKo: "실행력", nameEn: "Execution", category: "COM" },
    { skillId: "COM011", nameKo: "책임감", nameEn: "Responsibility", category: "COM" },
    { skillId: "COM012", nameKo: "신뢰성", nameEn: "Reliability", category: "COM" },
    { skillId: "COM013", nameKo: "자기주도 학습", nameEn: "Self-directed Learning", category: "COM" },
    { skillId: "COM014", nameKo: "정보탐색", nameEn: "Information Searching", category: "COM" },
    { skillId: "COM015", nameKo: "문서작성", nameEn: "Business Writing", category: "COM" },
    { skillId: "COM016", nameKo: "발표·프레젠테이션", nameEn: "Presentation", category: "COM" },
    { skillId: "COM017", nameKo: "갈등관리", nameEn: "Conflict Management", category: "COM" },
    { skillId: "COM018", nameKo: "시간관리", nameEn: "Time Management", category: "COM" },
    { skillId: "COM019", nameKo: "일정관리", nameEn: "Schedule Management", category: "COM" },
    { skillId: "COM020", nameKo: "우선순위 설정", nameEn: "Prioritization", category: "COM" },
    { skillId: "COM021", nameKo: "품질의식", nameEn: "Quality Orientation", category: "COM" },
    { skillId: "COM022", nameKo: "고객지향", nameEn: "Customer Orientation", category: "COM" },
    { skillId: "COM023", nameKo: "윤리의식", nameEn: "Ethics & Integrity", category: "COM" },
    { skillId: "COM024", nameKo: "규정·절차 준수", nameEn: "Compliance", category: "COM" },
    { skillId: "COM025", nameKo: "데이터 해석", nameEn: "Data Interpretation", category: "COM" },
    { skillId: "COM026", nameKo: "수리적 사고", nameEn: "Numerical Reasoning", category: "COM" },
    { skillId: "COM027", nameKo: "디지털 리터러시", nameEn: "Digital Literacy", category: "COM" },
    { skillId: "COM028", nameKo: "문제원인 분석", nameEn: "Root Cause Analysis", category: "COM" },
    { skillId: "COM029", nameKo: "개선제안", nameEn: "Continuous Improvement", category: "COM" },
    { skillId: "COM030", nameKo: "시스템 사고", nameEn: "Systems Thinking", category: "COM" },
    { skillId: "COM031", nameKo: "변화관리", nameEn: "Change Management", category: "COM" },
    { skillId: "COM032", nameKo: "이해관계자 조율", nameEn: "Stakeholder Coordination", category: "COM" },
    { skillId: "COM033", nameKo: "피드백 수용", nameEn: "Feedback Acceptance", category: "COM" },
    { skillId: "COM034", nameKo: "피드백 제공", nameEn: "Feedback Giving", category: "COM" },
    { skillId: "COM035", nameKo: "스트레스 관리", nameEn: "Stress Management", category: "COM" },
    { skillId: "COM036", nameKo: "자기성찰", nameEn: "Self Reflection", category: "COM" },
    { skillId: "COM037", nameKo: "목표 설정", nameEn: "Goal Setting", category: "COM" },
    { skillId: "COM038", nameKo: "리스크 인식", nameEn: "Risk Awareness", category: "COM" },
    { skillId: "COM039", nameKo: "상황판단", nameEn: "Situational Judgement", category: "COM" },
    { skillId: "COM040", nameKo: "협상 기초", nameEn: "Basic Negotiation", category: "COM" },

    // 경영·기획 (MGT)
    { skillId: "MGT001", nameKo: "전략수립", nameEn: "Strategy Formulation", category: "MGT" },
    { skillId: "MGT002", nameKo: "KPI 설계", nameEn: "KPI Design", category: "MGT" },
    { skillId: "MGT003", nameKo: "시장조사", nameEn: "Market Research", category: "MGT" },
    { skillId: "MGT004", nameKo: "경쟁사 분석", nameEn: "Competitor Analysis", category: "MGT" },
    { skillId: "MGT005", nameKo: "사업타당성 분석", nameEn: "Business Feasibility Analysis", category: "MGT" },
    { skillId: "MGT006", nameKo: "재무모델링 기초", nameEn: "Basic Financial Modeling", category: "MGT" },
    { skillId: "MGT007", nameKo: "사업계획서 작성", nameEn: "Business Plan Writing", category: "MGT" },
    { skillId: "MGT008", nameKo: "조직·프로세스 분석", nameEn: "Organization & Process Analysis", category: "MGT" },
    { skillId: "MGT009", nameKo: "정책·제도 설계", nameEn: "Policy & System Design", category: "MGT" },
    { skillId: "MGT010", nameKo: "리스크 평가", nameEn: "Risk Assessment", category: "MGT" },
    { skillId: "MGT011", nameKo: "데이터 기반 의사결정", nameEn: "Data-Driven Decision Making", category: "MGT" },
    { skillId: "MGT012", nameKo: "벤치마킹 수행", nameEn: "Benchmarking", category: "MGT" },

    // 마케팅 (MKT)
    { skillId: "MKT001", nameKo: "브랜드 전략", nameEn: "Brand Strategy", category: "MKT" },
    { skillId: "MKT002", nameKo: "콘텐츠 기획", nameEn: "Content Planning", category: "MKT" },
    { skillId: "MKT003", nameKo: "캠페인 기획", nameEn: "Campaign Planning", category: "MKT" },
    { skillId: "MKT004", nameKo: "디지털 마케팅 이해", nameEn: "Digital Marketing Fundamentals", category: "MKT" },
    { skillId: "MKT005", nameKo: "SNS 채널 운영", nameEn: "Social Media Management", category: "MKT" },
    { skillId: "MKT006", nameKo: "SEO·검색최적화 기초", nameEn: "Basic SEO", category: "MKT" },
    { skillId: "MKT007", nameKo: "퍼포먼스 광고 이해", nameEn: "Performance Ads Fundamentals", category: "MKT" },
    { skillId: "MKT008", nameKo: "고객세분화", nameEn: "Customer Segmentation", category: "MKT" },
    { skillId: "MKT009", nameKo: "타겟 페르소나 설계", nameEn: "Persona Design", category: "MKT" },
    { skillId: "MKT010", nameKo: "랜딩페이지 기획", nameEn: "Landing Page Planning", category: "MKT" },
    { skillId: "MKT011", nameKo: "마케팅 성과 분석", nameEn: "Marketing Performance Analysis", category: "MKT" },
    { skillId: "MKT012", nameKo: "A/B 테스트 설계", nameEn: "A/B Test Design", category: "MKT" },
    { skillId: "MKT013", nameKo: "고객 인사이트 도출", nameEn: "Customer Insight Generation", category: "MKT" },
    { skillId: "MKT014", nameKo: "브랜드 톤앤매너 관리", nameEn: "Brand Tone & Manner", category: "MKT" },

    // 영업·BD (SAL)
    { skillId: "SAL001", nameKo: "잠재고객 발굴", nameEn: "Lead Generation", category: "SAL" },
    { skillId: "SAL002", nameKo: "고객 니즈 파악", nameEn: "Needs Analysis", category: "SAL" },
    { skillId: "SAL003", nameKo: "제안서 작성", nameEn: "Proposal Writing", category: "SAL" },
    { skillId: "SAL004", nameKo: "영업 프레젠테이션", nameEn: "Sales Presentation", category: "SAL" },
    { skillId: "SAL005", nameKo: "가격·조건 협상", nameEn: "Price & Terms Negotiation", category: "SAL" },
    { skillId: "SAL006", nameKo: "파이프라인 관리", nameEn: "Sales Pipeline Management", category: "SAL" },
    { skillId: "SAL007", nameKo: "관계 형성·유지", nameEn: "Relationship Building", category: "SAL" },
    { skillId: "SAL008", nameKo: "계약·견적 관리", nameEn: "Contract & Quotation Handling", category: "SAL" },
    { skillId: "SAL009", nameKo: "데모·시연 진행", nameEn: "Product Demo", category: "SAL" },
    { skillId: "SAL010", nameKo: "영업 전략 수립 기초", nameEn: "Basic Sales Strategy", category: "SAL" },

    // 고객지원·운영 (OPS)
    { skillId: "OPS001", nameKo: "고객 문의 응대", nameEn: "Customer Inquiry Handling", category: "OPS" },
    { skillId: "OPS002", nameKo: "VOC 분석", nameEn: "Voice of Customer Analysis", category: "OPS" },
    { skillId: "OPS003", nameKo: "FAQ·매뉴얼 작성", nameEn: "FAQ & Manual Creation", category: "OPS" },
    { skillId: "OPS004", nameKo: "업무 프로세스 운영", nameEn: "Operations Process Execution", category: "OPS" },
    { skillId: "OPS005", nameKo: "서비스 품질 모니터링", nameEn: "Service Quality Monitoring", category: "OPS" },
    { skillId: "OPS006", nameKo: "이슈·클레임 처리", nameEn: "Issue & Claim Handling", category: "OPS" },
    { skillId: "OPS007", nameKo: "업무 표준화", nameEn: "Operations Standardization", category: "OPS" },
    { skillId: "OPS008", nameKo: "서비스 지표 관리", nameEn: "Service KPI Management", category: "OPS" },

    // PM/PO (PM)
    { skillId: "PM001", nameKo: "요구사항 수집", nameEn: "Requirements Gathering", category: "PM" },
    { skillId: "PM002", nameKo: "요구사항 정의", nameEn: "Requirements Definition", category: "PM" },
    { skillId: "PM003", nameKo: "사용자 리서치", nameEn: "User Research", category: "PM" },
    { skillId: "PM004", nameKo: "PRD 작성", nameEn: "Product Requirement Document", category: "PM" },
    { skillId: "PM005", nameKo: "기능 우선순위 설정", nameEn: "Feature Prioritization", category: "PM" },
    { skillId: "PM006", nameKo: "로드맵 수립", nameEn: "Product Roadmap Planning", category: "PM" },
    { skillId: "PM007", nameKo: "스프린트 계획", nameEn: "Sprint Planning", category: "PM" },
    { skillId: "PM008", nameKo: "백로그 관리", nameEn: "Backlog Management", category: "PM" },
    { skillId: "PM009", nameKo: "유저 플로우 설계", nameEn: "User Flow Design", category: "PM" },
    { skillId: "PM010", nameKo: "스토리보드 작성", nameEn: "Storyboard Creation", category: "PM" },
    { skillId: "PM011", nameKo: "릴리즈 계획·노트 작성", nameEn: "Release Planning & Notes", category: "PM" },
    { skillId: "PM012", nameKo: "품질테스트 기획", nameEn: "QA Planning", category: "PM" },
    { skillId: "PM013", nameKo: "이해관계자 커뮤니케이션", nameEn: "Stakeholder Communication", category: "PM" },
    { skillId: "PM014", nameKo: "KPI 설계·트래킹", nameEn: "Product KPI Tracking", category: "PM" },

    // 데이터 분석 (DATA)
    { skillId: "DATA001", nameKo: "데이터 수집 설계", nameEn: "Data Collection Design", category: "DATA" },
    { skillId: "DATA002", nameKo: "데이터 클렌징", nameEn: "Data Cleaning", category: "DATA" },
    { skillId: "DATA003", nameKo: "SQL 기초", nameEn: "Basic SQL", category: "DATA" },
    { skillId: "DATA004", nameKo: "통계 기초", nameEn: "Basic Statistics", category: "DATA" },
    { skillId: "DATA005", nameKo: "데이터 시각화", nameEn: "Data Visualization", category: "DATA" },
    { skillId: "DATA006", nameKo: "분석 가설 수립", nameEn: "Hypothesis Setting", category: "DATA" },
    { skillId: "DATA007", nameKo: "A/B 테스트 설계", nameEn: "A/B Test Design", category: "DATA" },
    { skillId: "DATA008", nameKo: "대시보드 기획", nameEn: "Dashboard Planning", category: "DATA" },
    { skillId: "DATA009", nameKo: "KPI 정의", nameEn: "KPI Definition", category: "DATA" },
    { skillId: "DATA010", nameKo: "퍼널 분석", nameEn: "Funnel Analysis", category: "DATA" },
    { skillId: "DATA011", nameKo: "코호트 분석", nameEn: "Cohort Analysis", category: "DATA" },
    { skillId: "DATA012", nameKo: "이상치 탐지 기초", nameEn: "Basic Anomaly Detection", category: "DATA" },
    { skillId: "DATA013", nameKo: "인사이트 도출", nameEn: "Insight Generation", category: "DATA" },
    { skillId: "DATA014", nameKo: "GA4·로그 분석 이해", nameEn: "Web/Log Analytics Fundamentals", category: "DATA" },

    // 개발 (DEV)
    { skillId: "DEV001", nameKo: "요구사항 분석", nameEn: "Requirements Analysis", category: "DEV" },
    { skillId: "DEV002", nameKo: "시스템 설계 기초", nameEn: "Basic System Design", category: "DEV" },
    { skillId: "DEV003", nameKo: "데이터베이스 설계", nameEn: "Database Design", category: "DEV" },
    { skillId: "DEV004", nameKo: "REST API 설계·구현", nameEn: "REST API Implementation", category: "DEV" },
    { skillId: "DEV005", nameKo: "버전관리(Git)", nameEn: "Version Control (Git)", category: "DEV" },
    { skillId: "DEV006", nameKo: "코드리뷰 참여", nameEn: "Code Review Participation", category: "DEV" },
    { skillId: "DEV007", nameKo: "예외 처리·에러 핸들링", nameEn: "Error Handling", category: "DEV" },
    { skillId: "DEV008", nameKo: "단위테스트 작성", nameEn: "Unit Testing", category: "DEV" },
    { skillId: "DEV009", nameKo: "성능 최적화 기초", nameEn: "Basic Performance Optimization", category: "DEV" },
    { skillId: "DEV010", nameKo: "보안 기초 이해", nameEn: "Basic Security Awareness", category: "DEV" },
    { skillId: "DEV011", nameKo: "CI/CD 파이프라인 이해", nameEn: "CI/CD Fundamentals", category: "DEV" },
    { skillId: "DEV012", nameKo: "로그 기반 문제분석", nameEn: "Log-based Debugging", category: "DEV" },
    { skillId: "DEV013", nameKo: "문서화 (README, API)", nameEn: "Technical Documentation", category: "DEV" },
    { skillId: "DEV014", nameKo: "협업 개발 프로세스(Jira 등)", nameEn: "Dev Collaboration Process", category: "DEV" },

    // 디자인 (DES)
    { skillId: "DES001", nameKo: "UX 리서치 기초", nameEn: "Basic UX Research", category: "DES" },
    { skillId: "DES002", nameKo: "와이어프레임 제작", nameEn: "Wireframing", category: "DES" },
    { skillId: "DES003", nameKo: "사용자 흐름 설계", nameEn: "User Flow Design", category: "DES" },
    { skillId: "DES004", nameKo: "UI 컴포넌트 설계", nameEn: "UI Component Design", category: "DES" },
    { skillId: "DES005", nameKo: "프로토타입 제작", nameEn: "Prototyping", category: "DES" },
    { skillId: "DES006", nameKo: "시각적 계층 구조", nameEn: "Visual Hierarchy", category: "DES" },
    { skillId: "DES007", nameKo: "디자인 시스템 이해", nameEn: "Design System Basics", category: "DES" },
    { skillId: "DES008", nameKo: "브랜드 일관성 유지", nameEn: "Brand Consistency", category: "DES" },
    { skillId: "DES009", nameKo: "인터랙션 디자인 기초", nameEn: "Interaction Design Basics", category: "DES" },
    { skillId: "DES010", nameKo: "사용성 테스트 기획", nameEn: "Usability Testing Planning", category: "DES" },

    // HR (HR)
    { skillId: "HR001", nameKo: "채용공고 작성", nameEn: "Job Posting Writing", category: "HR" },
    { skillId: "HR002", nameKo: "직무분석·직무기술서", nameEn: "Job Analysis & JD", category: "HR" },
    { skillId: "HR003", nameKo: "서류·면접 평가", nameEn: "Screening & Interview Evaluation", category: "HR" },
    { skillId: "HR004", nameKo: "온보딩 기획", nameEn: "Onboarding Design", category: "HR" },
    { skillId: "HR005", nameKo: "교육·육성 프로그램 기획", nameEn: "L&D Program Planning", category: "HR" },
    { skillId: "HR006", nameKo: "조직문화·Engagement 개선", nameEn: "Culture & Engagement", category: "HR" },
    { skillId: "HR007", nameKo: "성과관리 프로세스 이해", nameEn: "Performance Management Basics", category: "HR" },
    { skillId: "HR008", nameKo: "보상·인사제도 기초", nameEn: "Compensation & HR Policy Basics", category: "HR" },

    // 재무·회계 (FIN)
    { skillId: "FIN001", nameKo: "전표 처리", nameEn: "Journal Entry", category: "FIN" },
    { skillId: "FIN002", nameKo: "결산 지원", nameEn: "Closing Support", category: "FIN" },
    { skillId: "FIN003", nameKo: "재무제표 이해", nameEn: "Financial Statements Understanding", category: "FIN" },
    { skillId: "FIN004", nameKo: "비용·수익 분석", nameEn: "Cost & Revenue Analysis", category: "FIN" },
    { skillId: "FIN005", nameKo: "예산 편성·관리", nameEn: "Budget Planning & Control", category: "FIN" },
    { skillId: "FIN006", nameKo: "자금 운용 기초", nameEn: "Cash Management Basics", category: "FIN" },
    { skillId: "FIN007", nameKo: "내부통제 절차 이해", nameEn: "Internal Control Basics", category: "FIN" },
    { skillId: "FIN008", nameKo: "손익분석", nameEn: "Profit & Loss Analysis", category: "FIN" },

    // SCM·물류 (SCM)
    { skillId: "SCM001", nameKo: "재고 관리", nameEn: "Inventory Management", category: "SCM" },
    { skillId: "SCM002", nameKo: "발주·입고 관리", nameEn: "Ordering & Receiving", category: "SCM" },
    { skillId: "SCM003", nameKo: "물류 프로세스 이해", nameEn: "Logistics Process Basics", category: "SCM" },
    { skillId: "SCM004", nameKo: "운송·배송 관리", nameEn: "Transportation & Delivery", category: "SCM" },
    { skillId: "SCM005", nameKo: "리드타임 분석", nameEn: "Lead Time Analysis", category: "SCM" },
    { skillId: "SCM006", nameKo: "비용 절감 아이디어", nameEn: "Cost Reduction Ideas", category: "SCM" },
    { skillId: "SCM007", nameKo: "공급업체 관리", nameEn: "Supplier Management", category: "SCM" },
    { skillId: "SCM008", nameKo: "수요예측 기초", nameEn: "Basic Demand Forecasting", category: "SCM" },
    { skillId: "SCM009", nameKo: "창고 운영 이해", nameEn: "Warehouse Operations Basics", category: "SCM" },
    { skillId: "SCM010", nameKo: "공급망 성과지표 이해", nameEn: "SCM KPI Basics", category: "SCM" },

    // 생산·품질 (PRD)
    { skillId: "PRD001", nameKo: "공정 이해", nameEn: "Process Understanding", category: "PRD" },
    { skillId: "PRD002", nameKo: "작업 표준서(SOP) 준수", nameEn: "SOP Compliance", category: "PRD" },
    { skillId: "PRD003", nameKo: "생산 일정 준수", nameEn: "Production Schedule Adherence", category: "PRD" },
    { skillId: "PRD004", nameKo: "설비 점검·보전 지원", nameEn: "Equipment Check Support", category: "PRD" },
    { skillId: "PRD005", nameKo: "불량 분석", nameEn: "Defect Analysis", category: "PRD" },
    { skillId: "PRD006", nameKo: "품질 검사 수행", nameEn: "Quality Inspection", category: "PRD" },
    { skillId: "PRD007", nameKo: "안전수칙 준수", nameEn: "Safety Compliance", category: "PRD" },
    { skillId: "PRD008", nameKo: "생산성 개선 제안", nameEn: "Productivity Improvement", category: "PRD" },
    { skillId: "PRD009", nameKo: "규격·규정 이해", nameEn: "Standard & Regulation Understanding", category: "PRD" },
    { skillId: "PRD010", nameKo: "현장 데이터 기록·보고", nameEn: "Shop-floor Data Recording", category: "PRD" },

    // 공공·교육 (EDU)
    { skillId: "EDU001", nameKo: "교육과정 설계 기초", nameEn: "Basic Curriculum Design", category: "EDU" },
    { skillId: "EDU002", nameKo: "강의자료·교안 제작", nameEn: "Teaching Material Preparation", category: "EDU" },
    { skillId: "EDU003", nameKo: "학습자 분석", nameEn: "Learner Analysis", category: "EDU" },
    { skillId: "EDU004", nameKo: "행사·프로그램 운영", nameEn: "Program Operation", category: "EDU" },
    { skillId: "EDU005", nameKo: "정책·제도 조사", nameEn: "Policy Research", category: "EDU" },
    { skillId: "EDU006", nameKo: "통계·보고서 작성", nameEn: "Statistics & Reporting", category: "EDU" },
    { skillId: "EDU007", nameKo: "공공데이터 활용 기초", nameEn: "Public Data Utilization", category: "EDU" },
    { skillId: "EDU008", nameKo: "이해관계자 커뮤니케이션", nameEn: "Stakeholder Communication", category: "EDU" },

    // R&D (RND)
    { skillId: "RND001", nameKo: "문헌조사", nameEn: "Literature Review", category: "RND" },
    { skillId: "RND002", nameKo: "연구가설 설정", nameEn: "Research Hypothesis Setting", category: "RND" },
    { skillId: "RND003", nameKo: "실험 설계", nameEn: "Experiment Design", category: "RND" },
    { skillId: "RND004", nameKo: "데이터 수집·정리", nameEn: "Research Data Collection", category: "RND" },
    { skillId: "RND005", nameKo: "분석·해석", nameEn: "Research Data Analysis", category: "RND" },
    { skillId: "RND006", nameKo: "연구노트·보고서 작성", nameEn: "Lab Note & Report", category: "RND" },
    { skillId: "RND007", nameKo: "시제품·프로토타입 제작", nameEn: "Prototype Development", category: "RND" },
    { skillId: "RND008", nameKo: "특허·선행기술 조사", nameEn: "Patent & Prior Art Search", category: "RND" },

    // 글로벌·해외사업 (GLB)
    { skillId: "GLB001", nameKo: "영문 비즈니스 커뮤니케이션", nameEn: "English Business Communication", category: "GLB" },
    { skillId: "GLB002", nameKo: "이메일·리포트 작성", nameEn: "English Email & Report Writing", category: "GLB" },
    { skillId: "GLB003", nameKo: "해외 시장조사", nameEn: "Overseas Market Research", category: "GLB" },
    { skillId: "GLB004", nameKo: "무역 실무 기초", nameEn: "Basic Trade Operations", category: "GLB" },
    { skillId: "GLB005", nameKo: "인콰이어리·오퍼 대응", nameEn: "Inquiry & Offer Handling", category: "GLB" },
    { skillId: "GLB006", nameKo: "수출입 문서 이해", nameEn: "Trade Document Basics", category: "GLB" },
    { skillId: "GLB007", nameKo: "해외 파트너 발굴", nameEn: "Partner Sourcing", category: "GLB" },
    { skillId: "GLB008", nameKo: "문화적 차이 이해", nameEn: "Cross-cultural Awareness", category: "GLB" },
    { skillId: "GLB009", nameKo: "해외 바이어 미팅 준비", nameEn: "Buyer Meeting Preparation", category: "GLB" },
    { skillId: "GLB010", nameKo: "계약 조건 검토 기초", nameEn: "Basic Contract Term Review", category: "GLB" },
    { skillId: "GLB011", nameKo: "해외 프로젝트 일정관리", nameEn: "Global Project Scheduling", category: "GLB" },
    { skillId: "GLB012", nameKo: "글로벌 리스크 인식", nameEn: "Global Risk Awareness", category: "GLB" }
];

export const getJobName = (id: string): string => {
    return JOBS.find(j => j.jobId === id)?.nameKo || id;
};

export const getSkillName = (id: string): string => {
    return SKILLS.find(s => s.skillId === id)?.nameKo || id;
};

// Helper function to generate context string for LLM
export const getJobSkillDatabaseString = (): string => {
    let output = "## STANDARD JOB & SKILL DATABASE (NCS BASED)\n";
    output += "USE THESE IDs ONLY. DO NOT INVENT NEW CODES.\n\n";
    
    output += "[JOBS]\n";
    JOBS.forEach(j => output += `- ${j.jobId}: ${j.nameKo} (${j.nameEn})\n`);
    
    output += "\n[SKILLS]\n";
    // Group by category for better readability for LLM
    const skillsByCategory: Record<string, SkillDefinition[]> = {};
    SKILLS.forEach(s => {
        if (!skillsByCategory[s.category]) skillsByCategory[s.category] = [];
        skillsByCategory[s.category].push(s);
    });

    Object.keys(skillsByCategory).forEach(cat => {
        output += `\n--- ${cat} CATEGORY ---\n`;
        skillsByCategory[cat].forEach(s => output += `- ${s.skillId}: ${s.nameKo} (${s.nameEn})\n`);
    });
    
    return output;
};

// Helper function for scoring experience against jobs
export function scoreExperienceAgainstJobs(
    experience: Experience,
    mappings: JobSkillMapping[]
): JobScore[] {
    const expSkills = new Set(experience.skills || []);

    // 1) Group mappings by job
    const byJob: Record<string, JobSkillMapping[]> = {};
    for (const m of mappings) {
        if (!byJob[m.jobId]) byJob[m.jobId] = [];
        byJob[m.jobId].push(m);
    }

    const results: JobScore[] = [];

    for (const jobId of Object.keys(byJob)) {
        const jobMappings = byJob[jobId];

        let maxCore = 0;
        let maxPlus = 0;
        let coreScore = 0;
        let plusScore = 0;

        // 2) Calculate scores
        for (const m of jobMappings) {
            if (m.type === "core") {
                maxCore += m.weight;
                if (expSkills.has(m.skillId)) {
                    coreScore += m.weight;
                }
            } else {
                maxPlus += m.weight;
                if (expSkills.has(m.skillId)) {
                    plusScore += m.weight;
                }
            }
        }

        if (maxCore === 0) maxCore = 1;
        if (maxPlus === 0) maxPlus = 1;

        const coreRatio = coreScore / maxCore;
        const plusRatio = plusScore / maxPlus;

        // Weight Core higher (70%) than Plus (30%)
        const jobScoreRaw = 0.7 * coreRatio + 0.3 * plusRatio;
        const score = Math.round(jobScoreRaw * 100);

        results.push({
            jobId,
            score,
            coreRatio,
            plusRatio
        });
    }

    // 3) Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
}
