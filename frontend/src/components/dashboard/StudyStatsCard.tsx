'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  VStack,
  HStack,
  Progress,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Badge,
} from '@chakra-ui/react';
import { Clock, Target, TrendingUp } from 'lucide-react';
import { studyAPI } from '@/lib/api';

export default function StudyStatsCard() {
  const { data: studyStats } = useQuery({
    queryKey: ['study-stats'],
    queryFn: () => studyAPI.getStats(),
  });

  const { data: dailyData } = useQuery({
    queryKey: ['daily-data'],
    queryFn: () => studyAPI.getDailyData(),
  });

  const stats = studyStats?.data || {
    totalMinutes: 0,
    totalSessions: 0,
    totalPomodoros: 0,
    totalHours: 0,
  };

  const daily = dailyData?.data || {
    totalMinutes: 0,
    pomodoroCount: 0,
  };

  // 今日目标完成度 (假设目标是6小时)
  const dailyGoal = 6 * 60; // 6小时 = 360分钟
  const dailyProgress = Math.min((daily.totalMinutes / dailyGoal) * 100, 100);

  return (
    <Card h="full">
      <CardHeader pb={2}>
        <HStack>
          <Clock size={20} />
          <Heading size="md">学习统计</Heading>
        </HStack>
      </CardHeader>
      
      <CardBody pt={2}>
        <VStack spacing={4} align="stretch">
          {/* 今日学习时长 */}
          <VStack spacing={3} textAlign="center">
            <Box
              w="80px"
              h="80px"
              borderRadius="full"
              bg="brand.50"
              _dark={{ bg: 'brand.900' }}
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="4px solid"
              borderColor="brand.500"
            >
              <VStack spacing={0}>
                <Text fontSize="lg" fontWeight="bold" color="brand.500">
                  {Math.floor(daily.totalMinutes / 60)}
                </Text>
                <Text fontSize="xs" color="brand.500">小时</Text>
              </VStack>
            </Box>

            <Box w="full">
              <Progress
                value={dailyProgress}
                colorScheme="brand"
                size="sm"
                borderRadius="full"
              />
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mt={1}>
                今日学习进度
              </Text>
            </Box>
          </VStack>

          {/* 统计数据 */}
          <VStack spacing={3}>
            <HStack justify="space-between" w="full">
              <Stat size="sm">
                <StatLabel>今日番茄</StatLabel>
                <StatNumber>{daily.pomodoroCount}</StatNumber>
                <StatHelpText>个</StatHelpText>
              </Stat>
              <Stat size="sm" textAlign="right">
                <StatLabel>总时长</StatLabel>
                <StatNumber>{Math.round(stats.totalHours)}</StatNumber>
                <StatHelpText>小时</StatHelpText>
              </Stat>
            </HStack>

            <HStack justify="space-between" w="full">
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                今日目标
              </Text>
              <Badge colorScheme={dailyProgress >= 100 ? 'green' : 'orange'}>
                {Math.round(dailyProgress)}%
              </Badge>
            </HStack>

            <HStack justify="space-between" w="full">
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                总会话数
              </Text>
              <Text fontSize="sm" fontWeight="medium">
                {stats.totalSessions}
              </Text>
            </HStack>
          </VStack>

          {/* 添加任务按钮 */}
          <Box pt={2}>
            <HStack>
              <Target size={16} />
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                添加任务
              </Text>
            </HStack>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}
