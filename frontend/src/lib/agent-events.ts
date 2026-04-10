export const AGENT_DATA_CHANGED_EVENT = 'agent:data-changed';

export type AgentRefreshDomain =
  | 'tasks'
  | 'dayStart'
  | 'study'
  | 'pomodoro'
  | 'expenses'
  | 'exercise'
  | 'importantInfo';

export interface AgentDataChangedDetail {
  domains: AgentRefreshDomain[];
}

const TOOL_DOMAIN_MAP: Record<string, AgentRefreshDomain[]> = {
  start_day: ['dayStart'],
  create_task: ['tasks'],
  complete_task: ['tasks'],
  start_pomodoro: ['pomodoro'],
  stop_pomodoro: ['pomodoro', 'study', 'tasks'],
  record_meal_expense: ['expenses'],
  record_other_expense: ['expenses'],
  record_exercise: ['exercise'],
  set_exercise_feeling: ['exercise'],
  update_important_info: ['importantInfo'],
  update_day_reflection: [],
};

export function getAgentChangedDomains(
  toolResults: Array<{ tool?: string }> = [],
): AgentRefreshDomain[] {
  const domains = new Set<AgentRefreshDomain>();

  for (const toolResult of toolResults) {
    const mappedDomains = TOOL_DOMAIN_MAP[toolResult.tool ?? ''] ?? [];
    for (const domain of mappedDomains) {
      domains.add(domain);
    }
  }

  return Array.from(domains);
}

export function dispatchAgentDataChanged(domains: AgentRefreshDomain[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const uniqueDomains = Array.from(new Set(domains));
  if (uniqueDomains.length === 0) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AgentDataChangedDetail>(AGENT_DATA_CHANGED_EVENT, {
      detail: { domains: uniqueDomains },
    }),
  );
}

export function eventAffectsDomains(
  event: Event,
  domains: AgentRefreshDomain[],
): boolean {
  const detail = (event as CustomEvent<AgentDataChangedDetail | undefined>).detail;

  if (!detail?.domains?.length) {
    return true;
  }

  return domains.some(domain => detail.domains.includes(domain));
}
