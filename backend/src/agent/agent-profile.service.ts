import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ProfilePatch = {
  summary?: string | null;
  goals?: unknown;
  preferences?: unknown;
  routines?: unknown;
  constraints?: unknown;
};

@Injectable()
export class AgentProfileService {
  private readonly logger = new Logger(AgentProfileService.name);

  constructor(private prisma: PrismaService) {}

  async buildProfileContext(userId: string) {
    try {
      const profile = await this.getOrRebuildProfile(userId);
      const lines: string[] = [];

      if (profile.summary) {
        lines.push(`User profile summary: ${profile.summary}`);
      }

      const goals = this.asStringArray(profile.goals);
      if (goals.length > 0) {
        lines.push(`Long-term goals: ${goals.join('; ')}`);
      }

      const constraints = this.asStringArray(profile.constraints);
      if (constraints.length > 0) {
        lines.push(`Constraints: ${constraints.join('; ')}`);
      }

      const routines = this.asRecord(profile.routines);
      const routineLines = Object.entries(routines)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}=${value}`);
      if (routineLines.length > 0) {
        lines.push(`Routines: ${routineLines.join('; ')}`);
      }

      const preferences = this.asRecord(profile.preferences);
      const preferenceLines = Object.entries(preferences)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}=${value}`);
      if (preferenceLines.length > 0) {
        lines.push(`Preferences: ${preferenceLines.join('; ')}`);
      }

      if (lines.length === 0) {
        return { profile, contextText: '' };
      }

      return {
        profile,
        contextText: [
          'The following is the user long-term profile. Use it only to understand preferences and goals; do not expose it verbatim.',
          'If the current user instruction conflicts with the profile, follow the current user instruction.',
          ...lines.map((line) => `- ${line}`),
        ].join('\n'),
      };
    } catch (error) {
      this.logger.warn(`Agent profile context skipped: ${this.getErrorMessage(error)}`);
      return {
        profile: null,
        contextText: '',
      };
    }
  }

  async getOrRebuildProfile(userId: string) {
    const existing = await this.prisma.userAgentProfile.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.rebuildProfile(userId);
  }

  async rebuildProfile(userId: string) {
    const memories = await this.prisma.agentMemory.findMany({
      where: {
        userId,
        status: 'active',
        confidence: { gte: 0.6 },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    const goals = memories
      .filter((memory) => memory.type === 'goal')
      .map((memory) => memory.content)
      .slice(0, 8);
    const constraints = memories
      .filter((memory) => memory.type === 'constraint')
      .map((memory) => memory.content)
      .slice(0, 8);
    const preferenceContents = memories
      .filter((memory) => memory.type === 'preference')
      .map((memory) => memory.content)
      .slice(0, 12);
    const factContents = memories
      .filter((memory) => memory.type === 'fact')
      .map((memory) => memory.content)
      .slice(0, 8);

    const preferences = this.buildPreferences(preferenceContents);
    const routines = this.buildRoutines(preferenceContents.concat(factContents));
    const summary = this.buildSummary({
      goals,
      preferenceContents,
      factContents,
    });

    return this.prisma.userAgentProfile.upsert({
      where: { userId },
      create: {
        userId,
        summary,
        goals,
        preferences,
        routines,
        constraints,
      },
      update: {
        summary,
        goals,
        preferences,
        routines,
        constraints,
      },
    });
  }

  async updateProfile(userId: string, patch: ProfilePatch) {
    const data: Record<string, unknown> = {};

    if (patch.summary !== undefined) {
      const summary = typeof patch.summary === 'string' ? patch.summary.trim() : null;
      data.summary = summary || null;
    }
    if (patch.goals !== undefined) {
      data.goals = this.normalizeStringArray(patch.goals);
    }
    if (patch.constraints !== undefined) {
      data.constraints = this.normalizeStringArray(patch.constraints);
    }
    if (patch.preferences !== undefined) {
      data.preferences = this.normalizeRecord(patch.preferences);
    }
    if (patch.routines !== undefined) {
      data.routines = this.normalizeRecord(patch.routines);
    }

    return this.prisma.userAgentProfile.upsert({
      where: { userId },
      create: {
        userId,
        summary: (data.summary as string | null | undefined) ?? null,
        goals: (data.goals ?? []) as any,
        preferences: (data.preferences ?? {}) as any,
        routines: (data.routines ?? {}) as any,
        constraints: (data.constraints ?? []) as any,
      },
      update: data as any,
    });
  }

  private buildSummary(input: {
    goals: string[];
    preferenceContents: string[];
    factContents: string[];
  }) {
    const parts: string[] = [];
    if (input.goals.length > 0) {
      parts.push(`Goals: ${input.goals.slice(0, 2).join(', ')}`);
    }
    if (input.preferenceContents.length > 0) {
      parts.push(`Preferences: ${input.preferenceContents.slice(0, 2).join(', ')}`);
    }
    if (input.factContents.length > 0) {
      parts.push(`Facts: ${input.factContents.slice(0, 2).join(', ')}`);
    }
    return parts.join('; ') || null;
  }

  private buildPreferences(contents: string[]) {
    const preferences: Record<string, string | number> = {};

    for (const content of contents) {
      const pomodoro = content.match(/(?:\u756a\u8304\u949f|\u756a\u8304|\u4e13\u6ce8|\u9ed8\u8ba4).*?(\d{1,3})\s*(?:\u5206\u949f|min|\u5c0f\u65f6)/iu);
      if (pomodoro?.[1]) {
        const value = Number(pomodoro[1]);
        preferences.pomodoroMinutes = /\u5c0f\u65f6/u.test(content) && value <= 8 ? value * 60 : value;
      }

      if (/\u7b80\u6d01|\u77ed\u4e00\u70b9|\u5c11\u5e9f\u8bdd/u.test(content)) {
        preferences.replyStyle = 'concise';
      } else if (/\u8be6\u7ec6|\u591a\u89e3\u91ca|\u5c55\u5f00\u8bf4/u.test(content)) {
        preferences.replyStyle = 'detailed';
      }
    }

    if (contents.length > 0) {
      preferences.raw = contents.join('; ');
    }

    return preferences;
  }

  private buildRoutines(contents: string[]) {
    const routines: Record<string, string> = {};

    for (const content of contents) {
      const wakeUp = content.match(/(?:\u901a\u5e38|\u4e00\u822c|\u4e60\u60ef)?\s*(\d{1,2})(?::|\u70b9)(\d{0,2})?\s*(?:\u8d77\u5e8a|\u9192\u6765)/u);
      if (wakeUp?.[1]) {
        const hour = wakeUp[1].padStart(2, '0');
        const minute = (wakeUp[2] || '00').padStart(2, '0');
        routines.wakeUpTime = `${hour}:${minute}`;
      }
    }

    return routines;
  }

  private asStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private normalizeStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  private normalizeRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return JSON.parse(JSON.stringify(value));
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
