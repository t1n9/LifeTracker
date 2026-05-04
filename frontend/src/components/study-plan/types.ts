export interface PhasePlan {
  id: string;
  planId: string;
  name: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  sortOrder: number;
}

export interface PhaseDraft {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
}

export interface DailySlot {
  id: string;
  planId: string;
  date: string;
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  plannedHours: number;
  actualHours: number;
  status: 'pending' | 'injected' | 'completed' | 'skipped' | 'rescheduled';
  isDraft?: boolean;
  timeSegment?: string;
  phaseId?: string | null;
  taskId?: string | null;
}

export interface SlotDraft {
  date: string;
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  plannedHours: number;
  timeSegment?: string;
  phaseId?: string;
}

export interface StudyPlanLite {
  id: string;
  examName: string;
  examDate: string;
  examType: string;
  status: string;
  weekdayHours: number;
  weekendHours: number;
}

export interface WeekCheckResult {
  hasActivePlan: boolean;
  thisWeekMissing: boolean;
  nextWeekMissing: boolean;
  planId: string | null;
  examDaysLeft: number | null;
}

export interface PendingAction {
  action: 'generate_phases' | 'expand_week';
  originalMessage: string;
  targetWeekStart?: string;
  parsedIntent?: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isThinking?: boolean;
  pendingAction?: PendingAction;
  draftPhases?: PhaseDraft[];
  draftSlots?: SlotDraft[];
  draftWeekStart?: string;
}
