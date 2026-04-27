import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateConfirmationInput {
  runId: string | null;
  userId: string;
  toolName: string;
  args: Record<string, any>;
  summary: string;
}

@Injectable()
export class AgentConfirmationService {
  private readonly logger = new Logger(AgentConfirmationService.name);

  constructor(private prisma: PrismaService) {}

  async expirePendingForUser(userId: string) {
    try {
      await this.prisma.agentConfirmation.updateMany({
        where: {
          userId,
          status: 'pending',
        },
        data: {
          status: 'superseded',
          resolvedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Agent confirmation expiry skipped: ${this.getErrorMessage(error)}`);
    }
  }

  async create(input: CreateConfirmationInput) {
    if (!input.runId) {
      this.logger.warn('Agent confirmation create skipped: missing runId');
      return null;
    }

    try {
      return await this.prisma.agentConfirmation.create({
        data: {
          runId: input.runId,
          userId: input.userId,
          toolName: input.toolName,
          args: input.args,
          summary: input.summary,
        },
      });
    } catch (error) {
      this.logger.warn(`Agent confirmation create skipped: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  async findPending(userId: string, confirmationId: string) {
    try {
      return await this.prisma.agentConfirmation.findFirst({
        where: {
          id: confirmationId,
          userId,
          status: 'pending',
        },
      });
    } catch (error) {
      this.logger.warn(`Agent confirmation lookup skipped: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  async findRetriable(userId: string, confirmationId: string) {
    try {
      return await this.prisma.agentConfirmation.findFirst({
        where: {
          id: confirmationId,
          userId,
          status: { in: ['failed', 'rejected'] },
        },
      });
    } catch (error) {
      this.logger.warn(`Agent confirmation retry lookup skipped: ${this.getErrorMessage(error)}`);
      return null;
    }
  }

  async listForUser(userId: string, status = 'pending', limit = 20) {
    try {
      return await this.prisma.agentConfirmation.findMany({
        where: {
          userId,
          ...(status === 'all' ? {} : { status }),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(limit, 1), 100),
      });
    } catch (error) {
      this.logger.warn(`Agent confirmation list skipped: ${this.getErrorMessage(error)}`);
      return [];
    }
  }

  async markApproved(confirmationId: string) {
    try {
      await this.prisma.agentConfirmation.update({
        where: { id: confirmationId },
        data: {
          status: 'approved',
          resolvedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Agent confirmation approval update skipped: ${this.getErrorMessage(error)}`);
    }
  }

  async markExecuted(confirmationId: string, result: unknown) {
    try {
      await this.prisma.agentConfirmation.update({
        where: { id: confirmationId },
        data: {
          status: 'executed',
          result: this.toJsonValue(result),
          resolvedAt: new Date(),
          executedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Agent confirmation execution update skipped: ${this.getErrorMessage(error)}`);
    }
  }

  async markFailed(confirmationId: string, error: unknown, result?: unknown) {
    try {
      await this.prisma.agentConfirmation.update({
        where: { id: confirmationId },
        data: {
          status: 'failed',
          result: result === undefined ? undefined : this.toJsonValue(result),
          error: this.toJsonValue(error),
          resolvedAt: new Date(),
        },
      });
    } catch (updateError) {
      this.logger.warn(`Agent confirmation failure update skipped: ${this.getErrorMessage(updateError)}`);
    }
  }

  async markRejected(confirmationId: string) {
    try {
      await this.prisma.agentConfirmation.update({
        where: { id: confirmationId },
        data: {
          status: 'rejected',
          resolvedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Agent confirmation rejection update skipped: ${this.getErrorMessage(error)}`);
    }
  }

  private toJsonValue(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
