import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AgentRunStatus = 'running' | 'waiting_confirmation' | 'completed' | 'failed';

interface StartRunInput {
  userId: string;
  input: string;
  confirmMode: boolean;
  model?: string;
  promptVersion?: string;
  toolsetVersion?: string;
}

interface RecordStepInput {
  runId?: string | null;
  userId: string;
  type: string;
  status?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  durationMs?: number;
}

@Injectable()
export class AgentTraceService {
  private readonly logger = new Logger(AgentTraceService.name);

  constructor(private prisma: PrismaService) {}

  async startRun(input: StartRunInput) {
    try {
      const run = await this.prisma.agentRun.create({
        data: {
          userId: input.userId,
          input: input.input,
          confirmMode: input.confirmMode,
          model: input.model,
          promptVersion: input.promptVersion,
          toolsetVersion: input.toolsetVersion,
        },
      });
      return run.id;
    } catch (error) {
      this.logger.warn(`Agent trace startRun skipped: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  async finishRun(
    runId: string | null | undefined,
    status: AgentRunStatus,
    startedAt: number,
    error?: { code?: string; message?: string },
  ) {
    if (!runId) return;
    try {
      await this.prisma.agentRun.update({
        where: { id: runId },
        data: {
          status,
          completedAt: new Date(),
          latencyMs: Date.now() - startedAt,
          errorCode: error?.code,
          errorMessage: error?.message,
        },
      });
    } catch (updateError) {
      this.logger.warn(`Agent trace finishRun skipped: ${this.getErrorMessage(updateError)}`);
    }
  }

  async recordStep(input: RecordStepInput) {
    if (!input.runId) return;
    try {
      await this.prisma.agentRunStep.create({
        data: {
          runId: input.runId,
          userId: input.userId,
          type: input.type,
          status: input.status || 'success',
          input: input.input === undefined ? undefined : this.toJsonValue(input.input),
          output: input.output === undefined ? undefined : this.toJsonValue(input.output),
          error: input.error === undefined ? undefined : this.toJsonValue(input.error),
          durationMs: input.durationMs,
        },
      });
    } catch (error) {
      this.logger.warn(`Agent trace recordStep skipped: ${this.getErrorMessage(error)}`);
    }
  }

  private toJsonValue(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
