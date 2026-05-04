import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StudyPlanService } from './study-plan.service';
import { PhasePlanService } from './phase-plan.service';
import { StudyPlanReferenceService } from './study-plan-reference.service';
import {
  AiAssistDto,
  ConfirmOcrDto,
  ConfirmSearchSourceDto,
  CreateStudyChapterDto,
  CreateStudyPlanDto,
  CreateStudySubjectDto,
  SearchExamInfoDto,
  UpdateStudyChapterDto,
  UpdateStudyPlanDto,
  UpdateStudySubjectDto,
  UploadOcrDto,
} from './dto/study-plan.dto';
import {
  ConfirmPhasePlansDto,
  ConfirmWeekDto,
  ExpandWeekDto,
  GeneratePhasePlansDto,
  PlanChatDto,
  PlanExecuteDto,
  UpdatePhasePlanDto,
} from './dto/phase-plan.dto';

@ApiTags('study-plan')
@Controller('study-plans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudyPlanController {
  constructor(
    private readonly studyPlanService: StudyPlanService,
    private readonly phasePlanService: PhasePlanService,
    private readonly refService: StudyPlanReferenceService,
  ) {}

  // ─── Phase Plan & Week Expansion ─────────────────────────────
  // 注意：这些静态路径必须放在 :id 之前，否则会被吞掉

  @Get('week-check')
  @ApiOperation({ summary: '检测当前活跃计划的本周/下周是否缺少安排（用于小红点）' })
  weekCheck(@Request() req) {
    return this.phasePlanService.checkWeekStatus(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create study plan' })
  create(@Request() req, @Body() dto: CreateStudyPlanDto) {
    return this.studyPlanService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List study plans' })
  findAll(@Request() req) {
    return this.studyPlanService.findAll(req.user.id);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active study plan' })
  findActive(@Request() req) {
    return this.studyPlanService.findActive(req.user.id);
  }

  @Get('today-suggestion')
  @ApiOperation({ summary: 'Get today suggestion slots' })
  getTodaySuggestion(@Request() req) {
    return this.studyPlanService.getTodaySuggestion(req.user.id);
  }

  @Post('inject-today')
  @ApiOperation({ summary: 'Inject today slots to tasks' })
  injectToday(@Request() req) {
    return this.studyPlanService.injectToday(req.user.id);
  }

  @Post('ocr/upload')
  @ApiOperation({ summary: 'Upload OCR result' })
  uploadOcr(@Request() req, @Body() dto: UploadOcrDto) {
    return this.studyPlanService.uploadOcr(req.user.id, dto);
  }

  @Post('ocr/:uploadId/confirm')
  @ApiOperation({ summary: 'Confirm OCR result' })
  confirmOcr(@Request() req, @Param('uploadId') uploadId: string, @Body() dto: ConfirmOcrDto) {
    return this.studyPlanService.confirmOcr(req.user.id, uploadId, dto);
  }

  @Delete('ocr/:uploadId')
  @ApiOperation({ summary: 'Discard OCR result' })
  discardOcr(@Request() req, @Param('uploadId') uploadId: string) {
    return this.studyPlanService.discardOcr(req.user.id, uploadId);
  }

  @Post('ai-assist')
  @ApiOperation({ summary: 'AI onboarding assistant - parse user message and return form patch' })
  aiAssist(@Request() req, @Body() dto: AiAssistDto) {
    return this.studyPlanService.aiAssist(req.user.id, dto);
  }

  @Post('search/exam-info')
  @ApiOperation({ summary: 'Search exam info' })
  searchExamInfo(@Request() req, @Body() dto: SearchExamInfoDto) {
    return this.studyPlanService.searchExamInfo(req.user.id, dto);
  }

  @Post('search/confirm')
  @ApiOperation({ summary: 'Confirm search source as trusted' })
  confirmSearch(@Request() req, @Body() dto: ConfirmSearchSourceDto) {
    return this.studyPlanService.confirmSearchSource(req.user.id, dto);
  }

  @Get('plan-references')
  @ApiOperation({ summary: '获取激活的计划参考（按 examType 筛选）' })
  getPlanReferences(@Query('examType') examType?: string) {
    return this.refService.listActive(examType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get study plan detail' })
  findOne(@Request() req, @Param('id') id: string) {
    return this.studyPlanService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update study plan' })
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateStudyPlanDto) {
    return this.studyPlanService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive study plan' })
  archive(@Request() req, @Param('id') id: string) {
    return this.studyPlanService.archive(req.user.id, id);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate study plan schedule' })
  regenerate(@Request() req, @Param('id') id: string) {
    return this.studyPlanService.regenerate(req.user.id, id);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause study plan' })
  pause(@Request() req, @Param('id') id: string) {
    return this.studyPlanService.pause(req.user.id, id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume study plan' })
  resume(@Request() req, @Param('id') id: string) {
    return this.studyPlanService.resume(req.user.id, id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete study plan and all related study plan data' })
  deletePermanently(@Request() req, @Param('id') id: string) {
    return this.studyPlanService.deletePermanently(req.user.id, id);
  }

  @Post(':id/subjects')
  @ApiOperation({ summary: 'Create study subject' })
  createSubject(@Request() req, @Param('id') id: string, @Body() dto: CreateStudySubjectDto) {
    return this.studyPlanService.createSubject(req.user.id, id, dto);
  }

  @Patch(':id/subjects/:subjectId')
  @ApiOperation({ summary: 'Update study subject' })
  updateSubject(
    @Request() req,
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: UpdateStudySubjectDto,
  ) {
    return this.studyPlanService.updateSubject(req.user.id, id, subjectId, dto);
  }

  @Delete(':id/subjects/:subjectId')
  @ApiOperation({ summary: 'Delete study subject' })
  deleteSubject(@Request() req, @Param('id') id: string, @Param('subjectId') subjectId: string) {
    return this.studyPlanService.deleteSubject(req.user.id, id, subjectId);
  }

  @Post(':id/subjects/:subjectId/chapters')
  @ApiOperation({ summary: 'Create study chapter' })
  createChapter(
    @Request() req,
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: CreateStudyChapterDto,
  ) {
    return this.studyPlanService.createChapter(req.user.id, id, subjectId, dto);
  }

  @Patch(':id/subjects/:subjectId/chapters/:chId')
  @ApiOperation({ summary: 'Update study chapter' })
  updateChapter(
    @Request() req,
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @Param('chId') chId: string,
    @Body() dto: UpdateStudyChapterDto,
  ) {
    return this.studyPlanService.updateChapter(req.user.id, id, subjectId, chId, dto);
  }

  @Delete(':id/subjects/:subjectId/chapters/:chId')
  @ApiOperation({ summary: 'Delete study chapter' })
  deleteChapter(
    @Request() req,
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @Param('chId') chId: string,
  ) {
    return this.studyPlanService.deleteChapter(req.user.id, id, subjectId, chId);
  }

  @Post(':id/subjects/:subjectId/chapters/:chId/complete')
  @ApiOperation({ summary: 'Mark chapter complete' })
  completeChapter(
    @Request() req,
    @Param('id') id: string,
    @Param('subjectId') subjectId: string,
    @Param('chId') chId: string,
  ) {
    return this.studyPlanService.completeChapter(req.user.id, id, subjectId, chId);
  }

  @Get(':id/weekly')
  @ApiOperation({ summary: 'Get weekly plans' })
  getWeekly(@Request() req, @Param('id') id: string) {
    return this.studyPlanService.getWeekly(req.user.id, id);
  }

  @Get(':id/weekly/:weekNumber')
  @ApiOperation({ summary: 'Get one weekly plan by weekNumber' })
  getWeek(@Request() req, @Param('id') id: string, @Param('weekNumber', ParseIntPipe) weekNumber: number) {
    return this.studyPlanService.getWeek(req.user.id, id, weekNumber);
  }

  @Get(':id/today')
  @ApiOperation({ summary: 'Get today slots' })
  getToday(@Request() req, @Param('id') id: string, @Query('date') date?: string) {
    return this.studyPlanService.getToday(req.user.id, id, date);
  }

  @Post(':id/slots/:slotId/inject')
  @ApiOperation({ summary: 'Inject one slot as task' })
  injectSlot(@Request() req, @Param('id') id: string, @Param('slotId') slotId: string) {
    return this.studyPlanService.injectSlot(req.user.id, id, slotId);
  }

  @Post(':id/slots/:slotId/skip')
  @ApiOperation({ summary: 'Skip one slot' })
  skipSlot(@Request() req, @Param('id') id: string, @Param('slotId') slotId: string) {
    return this.studyPlanService.skipSlot(req.user.id, id, slotId);
  }

  @Post(':id/slots/:slotId/complete')
  @ApiOperation({ summary: 'Complete one slot' })
  completeSlot(@Request() req, @Param('id') id: string, @Param('slotId') slotId: string) {
    return this.studyPlanService.completeSlot(req.user.id, id, slotId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get study plan stats' })
  getStats(@Request() req, @Param('id') id: string) {
    return this.studyPlanService.getStats(req.user.id, id);
  }

  // ─── Phase Plan CRUD ────────────────────────────────────────

  @Get(':id/phase-plans')
  @ApiOperation({ summary: '列出某计划的全部阶段' })
  listPhases(@Request() req, @Param('id') id: string) {
    return this.phasePlanService.listPhases(req.user.id, id);
  }

  @Post(':id/phase-plans/draft')
  @ApiOperation({ summary: '根据用户意图生成阶段划分草稿（不写库）' })
  generatePhasesDraft(@Request() req, @Param('id') id: string, @Body() dto: GeneratePhasePlansDto) {
    return this.phasePlanService.generatePhasesDraft(req.user.id, id, dto);
  }

  @Post(':id/phase-plans/confirm')
  @ApiOperation({ summary: '确认阶段划分，写入数据库' })
  confirmPhases(@Request() req, @Param('id') id: string, @Body() dto: ConfirmPhasePlansDto) {
    return this.phasePlanService.confirmPhases(req.user.id, id, dto);
  }

  @Patch(':id/phase-plans/:phaseId')
  @ApiOperation({ summary: '修改某阶段' })
  updatePhase(
    @Request() req,
    @Param('id') id: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdatePhasePlanDto,
  ) {
    return this.phasePlanService.updatePhase(req.user.id, id, phaseId, dto);
  }

  @Delete(':id/phase-plans/:phaseId')
  @ApiOperation({ summary: '删除某阶段' })
  deletePhase(@Request() req, @Param('id') id: string, @Param('phaseId') phaseId: string) {
    return this.phasePlanService.deletePhase(req.user.id, id, phaseId);
  }

  // ─── Week Expansion ─────────────────────────────────────────

  @Post(':id/expand-week')
  @ApiOperation({ summary: 'AI 生成某周每日 slot 草稿（不写库）' })
  expandWeek(@Request() req, @Param('id') id: string, @Body() dto: ExpandWeekDto) {
    return this.phasePlanService.expandWeekDraft(req.user.id, id, dto);
  }

  @Post(':id/confirm-week')
  @ApiOperation({ summary: '确认周草稿，写入 DailyStudySlot' })
  confirmWeek(@Request() req, @Param('id') id: string, @Body() dto: ConfirmWeekDto) {
    return this.phasePlanService.confirmWeek(req.user.id, id, dto);
  }

  @Delete(':id/week/:weekStart')
  @ApiOperation({ summary: '清空某周已排好的 slot（用于重新规划）' })
  clearWeek(@Request() req, @Param('id') id: string, @Param('weekStart') weekStart: string) {
    return this.phasePlanService.clearWeek(req.user.id, id, weekStart);
  }

  // ─── AI Estimate ────────────────────────────────────────────

  @Post(':id/estimate-hours')
  @ApiOperation({ summary: 'AI 估算所有章节时长' })
  estimateHours(@Request() req, @Param('id') id: string) {
    return this.phasePlanService.estimateChapterHours(req.user.id, id);
  }

  // ─── AI Chat ─────────────────────────────────────────────────

  @Post(':id/chat')
  @ApiOperation({ summary: 'AI 意图识别（快速），返回理解给用户确认' })
  chat(@Request() req, @Param('id') id: string, @Body() dto: PlanChatDto) {
    return this.phasePlanService.chatIntent(req.user.id, id, dto.message, dto.weekStart, dto.currentDraftSlots);
  }

  @Post(':id/chat/execute')
  @ApiOperation({ summary: 'AI 执行生成（用户确认后调用）' })
  chatExecute(@Request() req, @Param('id') id: string, @Body() dto: PlanExecuteDto) {
    return this.phasePlanService.chatExecute(req.user.id, id, dto.action, dto.message, dto.weekStart, dto.parsedIntent);
  }
}
