'use client';

import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Button,
  Select,
  Input,
  Spinner,
  Badge,
  useDisclosure,
  Text,
  Heading,
} from '@chakra-ui/react';
import { useStudyAnalysis, AnalysisQuery, StudyAnalysisResponse } from '@/hooks/useStudyAnalysis';
import { AnalysisModal } from './AnalysisModal';

export function StudyAnalysisWidget() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { analyze, loading, error } = useStudyAnalysis();

  const [analysis, setAnalysis] = useState<StudyAnalysisResponse | null>(null);
  const [queryType, setQueryType] = useState<'time-range' | 'goal-based' | 'subject-based'>('time-range');
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleAnalyze = async () => {
    const query: AnalysisQuery = {
      queryType,
      period,
    };

    if (period === 'custom') {
      query.startDate = startDate;
      query.endDate = endDate;
    }

    const result = await analyze(query);
    if (result) {
      setAnalysis(result);
      onOpen();
    }
  };

  return (
    <>
      <Box
        position="fixed"
        bottom="80px"
        right="20px"
        bg="white"
        borderRadius="lg"
        boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
        p={4}
        minW="280px"
        zIndex={50}
        border="1px solid"
        borderColor="gray.200"
      >
        <VStack spacing={4} align="stretch">
          <VStack spacing={2} align="stretch">
            <Heading size="sm">学习分析</Heading>
            <Text fontSize="sm" color="gray.600">
              根据学习数据生成分析和建议
            </Text>
          </VStack>

          <VStack spacing={3} align="stretch">
            <Select
              value={queryType}
              onChange={(e) => setQueryType(e.target.value as any)}
              size="sm"
              isDisabled={loading}
            >
              <option value="time-range">按时间段</option>
              <option value="goal-based">按目标</option>
              <option value="subject-based">按学科</option>
            </Select>

            {queryType === 'time-range' && (
              <>
                <Select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  size="sm"
                  isDisabled={loading}
                >
                  <option value="day">今天</option>
                  <option value="week">本周</option>
                  <option value="month">本月</option>
                  <option value="custom">自定义</option>
                </Select>

                {period === 'custom' && (
                  <>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      size="sm"
                      placeholder="开始日期"
                      isDisabled={loading}
                    />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      size="sm"
                      placeholder="结束日期"
                      isDisabled={loading}
                    />
                  </>
                )}
              </>
            )}
          </VStack>

          {error && (
            <Box bg="red.50" p={2} borderRadius="md" fontSize="sm" color="red.600">
              {error}
            </Box>
          )}

          <Button
            colorScheme="blue"
            size="sm"
            onClick={handleAnalyze}
            isLoading={loading}
            width="full"
          >
            {loading ? '分析中...' : '生成分析'}
          </Button>

          {analysis && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpen}
              width="full"
            >
              查看详情
            </Button>
          )}
        </VStack>
      </Box>

      <AnalysisModal isOpen={isOpen} onClose={onClose} analysis={analysis} loading={loading} />
    </>
  );
}
