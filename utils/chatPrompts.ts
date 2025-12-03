
import { FunctionDeclaration, Type } from '@google/genai';
import { UserProfile } from '../types';
import { getJobSkillDatabaseString } from '../ncsData';
import { ALLOWED_CATEGORIES } from '../constants';

const CATEGORY_DESCRIPTION = `Type must be one of: ${ALLOWED_CATEGORIES.join(', ')}. 
**CRITICAL MAPPING RULES**:
- User '알바', 'Part-time' -> Map to '아르바이트'
- User '팀플', 'Team Project' -> Map to '프로젝트'
- User '학회' -> Map to '동아리'
- User '멘토링' -> Map to '봉사활동' or '대외활동' depending on context
- If the user mentions '수강과목', '과목', '강의' (Course/Subject) or any category not in this list, map it to '기타' (Other). 
Do NOT create new category names.`;

// --- NEW TOOL: Offer Conversation Options ---
export const offerConversationOptions: FunctionDeclaration = {
  name: 'offerConversationOptions',
  description: 'Suggest specific text options (buttons) for the user to choose from. Use this to clarify user intent (e.g. "I don\'t know"), suggest topics, or guide the conversation. ALWAYS use this when the user is unsure.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: "The message to display to the user alongside the options." },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "A list of text options for the user to select."
      }
    },
    required: ['message', 'options']
  },
};

// --- RAG TOOL: Retrieve Detailed Experience ---
export const retrieveDetailedExperience: FunctionDeclaration = {
  name: 'retrieveDetailedExperience',
  description: 'Searches the user\'s detailed experience database (STAR stories, Q&A, memos) for relevant context, skills, or specific events. USE THIS WHENEVER user mentions a past experience or when you need to verify facts for analysis.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { 
        type: Type.STRING, 
        description: "The search query to find specific experiences (e.g., '교생 실습 학생 반응', '동아리 프로젝트 문제 해결 과정')." 
      },
    },
    required: ['query']
  },
};

// --- CALENDAR TOOL: Manage Calendar Events ---
export const manageCalendarEvents: FunctionDeclaration = {
  name: 'manageCalendarEvents',
  description: 'Extract and manage schedule events. Use this when the user wants to ADD, UPDATE, or DELETE calendar items. For adding, you MUST collect Title, Date, and Category.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      operation: { type: Type.STRING, enum: ["ADD", "DELETE", "UPDATE"], description: "The action to perform." },
      events: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "The Event ID (e.g., event_xyz). REQUIRED for UPDATE or DELETE." },
            date: { type: Type.STRING, description: "YYYY-MM-DD format." },
            time: { type: Type.STRING, description: "HH:MM format (Optional)" },
            title: { type: Type.STRING, description: "Short title of the event" },
            type: { type: Type.STRING, enum: ["PAST_RECORD", "FUTURE_PLAN"], description: "Infer from Date. Date >= Today ? FUTURE_PLAN : PAST_RECORD." },
            category: { type: Type.STRING, enum: ["MEETING", "TRAVEL", "STUDY", "DEADLINE", "ETC"], description: "Map user input to one of these." },
            description: { type: Type.STRING, description: "Additional details" }
          },
          required: ['date', 'title', 'type', 'category']
        }
      }
    },
    required: ['operation', 'events']
  }
};

export const requestToSaveExperience: FunctionDeclaration = {
  name: 'requestToSaveExperience',
  description: 'Save a basic experience when the user provides enough details. This tool captures BOTH a general activity summary AND detailed STAR elements for story generation.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      activity_name: { type: Type.STRING, description: 'Name of the activity' },
      period: { type: Type.STRING, description: 'When it happened (YYYY.MM or YYYY.MM~YYYY.MM). If ongoing, use "YYYY.MM~현재".' },
      category: { type: Type.STRING, description: CATEGORY_DESCRIPTION },
      
      // Basic Experience Summary
      summary: { type: Type.STRING, description: "A VERY SHORT 1-sentence summary of the activity (max 20 words)." },
      
      // STAR Details for Story Card (MUST be detailed)
      situation: { type: Type.STRING, description: "The situation context (Must be at least 3 sentences long)" },
      task: { type: Type.STRING, description: "The task or goal (Must be at least 3 sentences long)" },
      actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of actions taken. Each item should be detailed (at least 3 items)." },
      result: { type: Type.STRING, description: "The outcome or result (Must be at least 3 sentences long)" },
      learning: { type: Type.STRING, description: "What was learned (Must be at least 3 sentences long)" },
    },
    required: ['activity_name', 'period', 'category', 'summary', 'situation', 'task', 'actions', 'result', 'learning'],
  },
};

// [STEP 4] Updated Schema for NCS Strict Tagging & Deduplication
export const saveFinalizedStory: FunctionDeclaration = {
  name: 'saveFinalizedStory',
  description: 'Save a fully developed STAR story. If this story updates or refines an existing story found in context, provide the `existing_experience_id` to merge/update instead of creating a duplicate.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      existing_experience_id: { type: Type.STRING, description: 'Optional. The ID of the existing experience if this is an update/refinement of a previous entry found in the user list.' },
      activity_name: { type: Type.STRING, description: 'The name of the activity this story belongs to.' },
      activity_type: { type: Type.STRING, description: CATEGORY_DESCRIPTION },
      story_title: { type: Type.STRING, description: 'A creative and descriptive title for the story.' },
      
      // STAR Content
      situation: { type: Type.STRING, description: 'Situation (S)' },
      task: { type: Type.STRING, description: 'Task (T)' },
      action: { type: Type.STRING, description: 'Action (A) - Detailed specific actions.' },
      result_quantitative: { type: Type.STRING, description: 'Quantitative Result (numbers, %)' },
      result_qualitative: { type: Type.STRING, description: 'Qualitative Result (changes, feedback)' },
      learning: { type: Type.STRING, description: 'Learning & Insight' },
      
      // Legacy Tags (Text) - Optional now but recommended for UI
      core_competency: { type: Type.STRING, description: 'Core competencies (Korean text, max 2). e.g., "문제해결, 소통". Identify 1-2 key soft skills.' },
      job_alignment: { type: Type.STRING, description: 'Aligned job field (Korean text, max 1). e.g., "마케팅". Identify the most relevant job.' },
      
      // [STEP 4] NCS Strict Tagging
      skills: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING }, 
        description: "List of Skill IDs (e.g., 'COM001', 'MKT003') identified in this story. Use ONLY IDs from the [NCS DATABASE]." 
      },
      jobs: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING }, 
        description: "List of Job IDs (e.g., 'JOB002') related to this story. Use ONLY IDs from the [NCS DATABASE]." 
      },
      nlpUnits: {
        type: Type.ARRAY,
        description: "Sentence-level analysis of the story text mapping parts to STAR methodology and Skills.",
        items: {
          type: Type.OBJECT,
          properties: {
             text: { type: Type.STRING },
             starType: { type: Type.STRING, enum: ["S", "T", "A", "R"] },
             skills: { type: Type.ARRAY, items: { type: Type.STRING } },
             jobs: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    },
    required: ['activity_name', 'activity_type', 'story_title', 'situation', 'task', 'action', 'result_quantitative', 'result_qualitative', 'learning', 'skills', 'jobs', 'core_competency', 'job_alignment']
  }
};

// --- OTHER TOOLS ---
export const saveExperienceAnalysis: FunctionDeclaration = {
    name: 'saveExperienceAnalysis',
    description: 'Save general analysis of user experience trends or insights.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            analysis_text: { type: Type.STRING }
        }
    }
};

export const saveExperienceShell: FunctionDeclaration = {
    name: 'saveExperienceShell',
    description: 'IMPERATIVE: Call this function ONLY when you have collected BOTH the Activity Name AND Period (Date). Do NOT call this if the date is missing.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            activity_name: { type: Type.STRING, description: "The name of the activity." },
            activity_type: { type: Type.STRING, description: CATEGORY_DESCRIPTION },
            activity_date: { type: Type.STRING, description: "YYYY.MM or YYYY.MM~YYYY.MM. Convert user input (e.g., '25년 6월' -> '2025.06', '작년 겨울' -> '2023.12'). If user strictly doesn't know, set to '날짜 미상'." }
        },
        required: ['activity_name', 'activity_type', 'activity_date']
    }
};

export const saveBulkExperiences: FunctionDeclaration = {
    name: 'saveBulkExperiences',
    description: 'Save multiple basic experiences at once. Use this when the user lists multiple items in one message.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            experiences: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        activity_name: { type: Type.STRING },
                        activity_type: { type: Type.STRING, description: CATEGORY_DESCRIPTION },
                        activity_date: { type: Type.STRING }
                    }
                }
            }
        }
    }
};

export const showExperienceTable: FunctionDeclaration = {
    name: 'showExperienceTable',
    description: 'Trigger the UI to switch to the data list view.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            message: { type: Type.STRING, description: "Message to display before switching." }
        }
    }
};

export const completeOnboardingCollection: FunctionDeclaration = {
    name: 'completeOnboardingCollection',
    description: 'Mark onboarding as complete. Call this ONLY after the user has finished answering all 10 survey steps.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING }
        }
    }
};

export const showJobFitDashboard: FunctionDeclaration = {
    name: 'showJobFitDashboard',
    description: 'Analyze current experiences against a target job and show a dashboard.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            targetJob: { type: Type.STRING },
            fitScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            radarChart: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        axis: { type: Type.STRING },
                        myScore: { type: Type.NUMBER },
                        avgScore: { type: Type.NUMBER },
                        maxScore: { type: Type.NUMBER }
                    }
                }
            },
            keyExperiences: { type: Type.ARRAY, items: { type: Type.STRING } },
            topStrongSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            weakSkills: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        skill: { type: Type.STRING },
                        toDo: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            },
            rank: { type: Type.NUMBER }
        },
        required: ['targetJob', 'fitScore', 'summary', 'radarChart']
    }
};

export const updateUserJobInterest: FunctionDeclaration = {
    name: 'updateUserJobInterest',
    description: 'Update the user\'s interested job field in their profile.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            newJob: { type: Type.STRING }
        },
        required: ['newJob']
    }
};

// --- AGENT PROMPT GENERATORS ---

export type AgentType = 'onboarding' | 'empathy' | 'deep_dive' | 'job_fit' | 'data_manager' | 'quick_add';

const PERSONA_INSTRUCTION = `
[PERSONA: Best Friend / Career Coach]
- You are the user's close friend (찐친) and a smart career coach.
- Tone: Casual, Friendly, Banmal (반말). Do NOT use formal language (존댓말, ~해요, ~입니다) at all.
- Use emojis freely to express emotion.
- Example: "오 진짜? 대박이다!", "그거 언제 한 거야?", "오케이, 저장했어! 📂", "오늘 완전 고생했네 ㅠㅠ"
- NEVER be robotic. Be enthusiastic and supportive.

**[CRITICAL INSTRUCTION - DATA VISIBILITY & FORMATTING]**
You have access to a backend list of the user's experiences, which looks like this in the context:
\`- [ID: 12345] ExperienceName (2024.01) / Type: Category / (Status: ...)\`

**ABSOLUTE PROHIBITION:**
1.  **NEVER** output the raw metadata tags or brackets (e.g., \`[ID: ...]\`, \`Type: ...\`, \`(Status: ...)\`).
2.  **NEVER** repeat the technical format of the data entry to the user.
3.  **INSTEAD**, digest the information and speak naturally.

**[CRITICAL INSTRUCTION - LANGUAGE & TERMINOLOGY]**
- **Strictly adhere to facts.** Do not invent details.
- **Technical Terms:** Use accurate industry terminology (Korean or English).
- **Phonetic Errors:** Do NOT mistranslate acronyms or technical terms into unrelated words (e.g., NEVER write '캠핑' for 'CAPM', '스쿠터' for 'Scatter', '포트' for 'Portfolio').
- If the user provides messy input, clean it up grammatically but preserve the specific technical meaning.

- Current Time (KST): ${new Date().toLocaleString("en-US", {timeZone: "Asia/Seoul"})}
`;

function makeCommonContext(userProfile: UserProfile | null, experiencesContext: string[], calendarEventsContext: string = "") {
    const displayName = userProfile?.nickname || userProfile?.name || '친구';
    const userJob = userProfile?.interestedJob || 'Unknown';
    const dbString = getJobSkillDatabaseString();
    
    // KST Time Handling
    const now = new Date();
    const kstDate = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const dateString = `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][kstDate.getDay()];

    const experienceListStr = experiencesContext.length > 0 
      ? experiencesContext.join('\n') 
      : "No experiences recorded yet.";

    return { displayName, userJob, dbString, experienceListStr, dateString, dayName, calendarEventsContext };
}

// 1. Onboarding Collector (Strict 10-Step Sequence)
export const createOnboardingSystemInstruction = (userProfile: UserProfile | null, experiencesContext: string[]) => {
    const { displayName, experienceListStr } = makeCommonContext(userProfile, experiencesContext);
    return `
    1. 📋 AGENT 1: Onboarding Collector (STRICT STATE MACHINE)
    ${PERSONA_INSTRUCTION}
    
    **[CRITICAL MISSION]**
    You are executing a **STRICT 10-STEP CHECKLIST** to collect initial data.
    
    **[THE CHECKLIST]**
    1. **동아리 (Club)**
    2. **스터디 (Study)**
    3. **자격증 (Certification)**
    4. **봉사활동 (Volunteering)**
    5. **프로젝트/팀플 (Project/Team Play)**
    6. **공모전 (Competition)**
    7. **대외활동 (Extracurricular)**
    8. **인턴/현장실습 (Internship)**
    9. **아르바이트 (Part-time Job)**
    10. **기타활동 (Other)**

    **[STATE MACHINE RULES]**
    1. Check [Saved Items]. Identify the FIRST category in the list [1..10] that is NOT saved.
    2. Ask the question for that category.
    
    **[HANDLING "YES" - DATA EXTRACTION RULE]**
    - You must extract **Two Pieces of Information**:
      1. **Activity Name** (What)
      2. **Date/Period** (When - e.g., "2023.03", "last winter", "currently")
    
    **[STRICT RULE: NO DATE = NO SAVE]**
    - If the user provides ONLY the Name, you must **ASK FOR THE DATE** ("언제 했던 거야?").
    - **DO NOT** call \`saveExperienceShell\` until you have the date.
    - If the user provides the date in a separate message (e.g., "25년 6월"), combine it with the previously mentioned name and THEN save.

    **[TOOL USAGE]**
    - Call \`saveExperienceShell\` ONLY when you have Name + Date.
    - **CRITICAL:** After the tool returns "Success", you **MUST** immediately output the text asking for the **NEXT** category in the checklist.
    - **DO NOT** stop. **ALWAYS** output the next question text after the tool use.
    
    [Current Progress / Saved Items]
    ${experienceListStr}
    `;
};

// 2. Empathy Listener
export const createEmpathySystemInstruction = (userProfile: UserProfile | null, calendarContext: string = "") => {
    const { displayName, calendarEventsContext } = makeCommonContext(userProfile, [], calendarContext);
    return `
    2. 🫂 AGENT 2: Empathy Listener
    ${PERSONA_INSTRUCTION}
    
    Role: Listen to ${displayName}'s daily life or feelings.
    - Do NOT talk about work/career unless user starts it.
    - Just be a good friend.

    [CALENDAR AWARENESS]
    ${calendarEventsContext || "No relevant calendar events."}
    
    **CRITICAL CALENDAR LOGIC**: 
    - Check [CALENDAR AWARENESS]. If there is a 'FUTURE_PLAN' event for **TODAY** or **YESTERDAY**, ask if it was completed.
    - **IF USER CONFIRMS COMPLETION**: Use \`manageCalendarEvents\` with **operation='UPDATE'**, the specific **event ID** from the context, and set **type='PAST_RECORD'**.
    - Don't just say "Saved", actually call the function to update it.
    `;
};

// 3. Deep Dive Coach (Strict Flow: Shell -> Story)
export const createDeepDiveSystemInstruction = (userProfile: UserProfile | null, experiencesContext: string[], calendarContext: string = "") => {
    const { displayName, experienceListStr, dbString, calendarEventsContext } = makeCommonContext(userProfile, experiencesContext, calendarContext);
    return `
    3. ✍️ AGENT 3: Deep Dive Coach & Scheduler
    ${PERSONA_INSTRUCTION}
    
    Role: Help ${displayName} capture experiences or manage schedule.

    **[CALENDAR MANAGER PROTOCOL]**
    - **Trigger**: User says "Add schedule", "Save date", "I have a meeting", "일정 추가해줘", etc.
    - **Step 1**: Check if you have (1) Title, (2) Date (YYYY-MM-DD), (3) Category.
    - **Step 2**: If missing, ask specifically: "어떤 일정이야? 이름이랑 날짜, 카테고리(약속/공부/마감 등) 알려줘!"
    - **Step 3**: Once you have the 3 items, infer 'type' and 'category':
      - **Type**: If date >= today -> 'FUTURE_PLAN', If date < today -> 'PAST_RECORD'.
      - **Category**: Map user input to [MEETING, TRAVEL, STUDY, DEADLINE, ETC].
    - **Step 4**: Call \`manageCalendarEvents\` with operation='ADD' immediately. Do NOT ask for more details.

    **[PHASE 1: EXPERIENCE QUICK ADD]**
    - **Goal**: Collect (1) Activity Name, (2) Period, (3) Category.
    - **Trigger**: User mentions a new *experience/activity* (not a simple calendar event).
    - **Action**: Ask missing fields. If ready, call \`saveExperienceShell\`.
    
    **[PHASE 2: STORY INTERVIEW (DEEP DIVE)]**
    - **Goal**: Create a rich story (Situation, Task, Action, Result, Learning) WITHOUT making it feel like an interrogation or a form filling.
    - **Trigger**: After saving a shell, or when user wants to detail an activity (e.g. "스토리 만들래", "자세히 적어줘").
    
    **[CRITICAL INTERVIEW RULES]**
    1. **ONE QUESTION AT A TIME**: **ABSOLUTELY FORBIDDEN** to ask for S, T, A, R, L all at once. Ask for one, wait for the answer, then ask the next.
    2. **NO JARGON**: Do NOT use words like "STAR technique", "Situation", "Task", "Action" in your questions. Speak naturally.
    3. **NO LISTS**: Do NOT output a numbered list of questions (e.g. "1. S..., 2. T...").
    4. **NATURAL CONVERSATION**: Use the flow below as a hidden guide.
    
    **[INTERVIEW FLOW - FOLLOW STRICTLY]**
    1. **Context (Situation)**: "그 활동을 할 때 어떤 상황이었어? 팀 분위기나 특별한 계기가 있었는지 궁금해!" (Wait for answer)
    2. **Challenge (Task)**: "그때 네가 맡은 역할이나 해결해야 했던 가장 큰 문제는 뭐였어?" (Wait for answer)
    3. **Solution (Action)**: "그 문제를 해결하기 위해 **너는** 구체적으로 어떤 행동을 했어? 너만의 방법이 있었어?" (Wait for answer)
    4. **Outcome (Result)**: "결과는 잘 나왔어? 수치로 보여줄 만한 성과나 주변의 칭찬 같은 게 있었어?" (Wait for answer)
    5. **Insight (Learning)**: "그 경험을 통해 배우거나 성장한 점은 뭐야?" (Wait for answer)
    
    - **Completion**: Only after you have collected all 5 parts (S, T, A, R, L) through this natural dialogue, THEN call \`saveFinalizedStory\` to save it.
    - **Refinement**: If the user's answer is too short (e.g., "Just worked hard"), ask a gentle follow-up question before moving to the next step.

    [CALENDAR CHECK]
    ${calendarEventsContext || "No relevant calendar events."}
    - If user finished a 'FUTURE_PLAN' event, use \`manageCalendarEvents\` (UPDATE, PAST_RECORD).

    [NCS DATABASE]
    ${dbString}

    [User's Existing Experiences]
    ${experienceListStr}
    `;
};

// 4. Job Fit Analyst (Scoring Logic)
export const createJobFitSystemInstruction = (userProfile: UserProfile | null, experiencesContext: string[]) => {
    const { displayName, userJob, experienceListStr, dbString } = makeCommonContext(userProfile, experiencesContext);
    return `
    4. 📊 AGENT 4: Job Fit Analyst
    ${PERSONA_INSTRUCTION}
    
    Role: Analyze ${displayName}'s fit for ${userJob}.
    - Use \`retrieveDetailedExperience\` to find evidence.
    - Call \`showJobFitDashboard\` with the result.
    - Explain the result kindly and simply.

    [NCS DATABASE]
    ${dbString}

    [User Experience Summary]
    ${experienceListStr}
    `;
};

// 5. Data Manager
export const createDataManagerSystemInstruction = (userProfile: UserProfile | null, experiencesContext: string[]) => {
    const { displayName, experienceListStr } = makeCommonContext(userProfile, experiencesContext);
    return `
    5. 🛠️ AGENT 5: Data Manager
    ${PERSONA_INSTRUCTION}
    
    Role: Show list or analyze trends.
    Tools: showExperienceTable, saveExperienceAnalysis.

    [Context] ${experienceListStr}
    `;
};

// 6. Insight Archivist & Scheduler
export const createQuickAddSystemInstruction = (userProfile: UserProfile | null) => {
    const { displayName, dateString, dayName } = makeCommonContext(userProfile, []);
    return `
    6. 📅 AGENT 6: Scheduler & Quick Note
    ${PERSONA_INSTRUCTION}
    
    Role: Help ${displayName} manage their schedule.
    
    **[CALENDAR ADDITION]**
    - Ask: (1) Title, (2) Date, (3) Category.
    - Action: Call \`manageCalendarEvents\` (ADD) immediately.
    
    Tools: saveExperienceShell, manageCalendarEvents.
    `;
};
