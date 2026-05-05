import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

export interface StudyPlanReferenceDto {
  examType: string;
  name: string;
  matchKeywords?: string;
  durationDays?: number;
  description?: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

@Injectable()
export class StudyPlanReferenceService {
  private readonly logger = new Logger(StudyPlanReferenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    return this.prisma.$queryRaw<any[]>`
      SELECT id, exam_type AS "examType", name, match_keywords AS "matchKeywords",
             duration_days AS "durationDays", description,
             source_url AS "sourceUrl", source_title AS "sourceTitle",
             is_active AS "isActive", sort_order AS "sortOrder",
             created_at AS "createdAt"
      FROM study_plan_references
      ORDER BY exam_type, sort_order, created_at
    `;
  }

  async listActive(examType?: string) {
    if (examType) {
      return this.prisma.$queryRaw<any[]>`
        SELECT id, exam_type AS "examType", name, match_keywords AS "matchKeywords",
               duration_days AS "durationDays", description,
               source_url AS "sourceUrl", source_title AS "sourceTitle",
               sort_order AS "sortOrder"
        FROM study_plan_references
        WHERE is_active = true AND exam_type = ${examType}
        ORDER BY sort_order, created_at
      `;
    }
    return this.prisma.$queryRaw<any[]>`
      SELECT id, exam_type AS "examType", name, match_keywords AS "matchKeywords",
             duration_days AS "durationDays", description,
             source_url AS "sourceUrl", source_title AS "sourceTitle",
             sort_order AS "sortOrder"
      FROM study_plan_references
      WHERE is_active = true
      ORDER BY exam_type, sort_order, created_at
    `;
  }

  async create(dto: StudyPlanReferenceDto) {
    const id = randomUUID();
    const sourceTitle = dto.sourceTitle?.trim() || (dto.sourceUrl ? await this.fetchTitle(dto.sourceUrl) : null);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO study_plan_references
         (id, exam_type, name, match_keywords, duration_days, description, source_url, source_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      id,
      dto.examType,
      dto.name,
      dto.matchKeywords ?? '',
      dto.durationDays ?? 0,
      dto.description ?? null,
      dto.sourceUrl ?? null,
      sourceTitle,
    );
    return { id, sourceTitle };
  }

  async update(id: string, dto: Partial<StudyPlanReferenceDto>) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (dto.name !== undefined)          { sets.push(`name=$${idx++}`);           vals.push(dto.name); }
    if (dto.examType !== undefined)      { sets.push(`exam_type=$${idx++}`);       vals.push(dto.examType); }
    if (dto.matchKeywords !== undefined) { sets.push(`match_keywords=$${idx++}`);  vals.push(dto.matchKeywords); }
    if (dto.durationDays !== undefined)  { sets.push(`duration_days=$${idx++}`);   vals.push(dto.durationDays); }
    if (dto.description !== undefined)   { sets.push(`description=$${idx++}`);     vals.push(dto.description); }
    if (dto.sourceUrl !== undefined) {
      sets.push(`source_url=$${idx++}`);
      vals.push(dto.sourceUrl);
      const title = dto.sourceTitle?.trim() || (dto.sourceUrl ? await this.fetchTitle(dto.sourceUrl) : null);
      sets.push(`source_title=$${idx++}`);
      vals.push(title);
    } else if (dto.sourceTitle !== undefined) {
      sets.push(`source_title=$${idx++}`);
      vals.push(dto.sourceTitle?.trim() || null);
    }
    if (sets.length) {
      sets.push(`updated_at=now()`);
      vals.push(id);
      await this.prisma.$executeRawUnsafe(
        `UPDATE study_plan_references SET ${sets.join(',')} WHERE id=$${idx}`, ...vals,
      );
    }
    return { ok: true };
  }

  async setActive(id: string, isActive: boolean) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE study_plan_references SET is_active=$1, updated_at=now() WHERE id=$2`, isActive, id,
    );
    return { ok: true };
  }

  async delete(id: string) {
    await this.prisma.$executeRawUnsafe(`DELETE FROM study_plan_references WHERE id=$1`, id);
    return { ok: true };
  }

  async fetchTitleForUrl(url: string) {
    const title = await this.fetchTitle(url);
    return { title };
  }

  private async fetchTitle(url: string): Promise<string | null> {
    try {
      const res = await axios.get(url, {
        timeout: 6000,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        maxRedirects: 5,
      });
      const html = this.decodeHtml(Buffer.from(res.data), String(res.headers['content-type'] || ''));
      return this.extractHtmlTitle(html);
    } catch (e) {
      this.logger.warn(`fetchTitle failed for ${url}: ${e}`);
      return null;
    }
  }

  private decodeHtml(buffer: Buffer, contentType: string): string {
    const head = buffer.subarray(0, 4096).toString('ascii');
    const charset = (
      contentType.match(/charset=([^;\s]+)/i)?.[1] ||
      head.match(/<meta[^>]+charset=["']?([^"'\s/>]+)/i)?.[1] ||
      head.match(/<meta[^>]+content=["'][^"']*charset=([^"'\s;]+)/i)?.[1] ||
      'utf-8'
    ).toLowerCase();

    const normalized = charset.replace(/_/g, '-');
    const encoding = normalized === 'gbk' || normalized === 'gb2312' ? 'gb18030' : normalized;

    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }

  private extractHtmlTitle(html: string): string | null {
    const candidates = [
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,300})["'][^>]*>/i)?.[1],
      html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']{1,300})["'][^>]*>/i)?.[1],
      html.match(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']{1,300})["'][^>]*>/i)?.[1],
      html.match(/<title[^>]*>([\s\S]{1,500})<\/title>/i)?.[1],
    ];

    const title = candidates.find(value => value && value.trim());
    return title ? this.decodeEntities(title).replace(/\s+/g, ' ').trim().slice(0, 200) : null;
  }

  private decodeEntities(value: string): string {
    const named: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    };

    return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      const key = entity.toLowerCase();
      if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
      if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
      return named[key] ?? match;
    });
  }
}
