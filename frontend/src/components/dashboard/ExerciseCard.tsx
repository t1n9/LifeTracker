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
  Grid,
  GridItem,
  Button,
  Badge,
  IconButton,
} from '@chakra-ui/react';
import { Activity, Plus, TrendingUp } from 'lucide-react';
import { healthAPI } from '@/lib/api';

export default function ExerciseCard() {
  const { data: exerciseData } = useQuery({
    queryKey: ['exercise-records'],
    queryFn: () => healthAPI.getExerciseRecords(1),
  });

  const todayExercise = exerciseData?.data?.[0] || {
    pullUps: 0,
    squats: 0,
    pushUps: 0,
    running: 0,
    swimming: 0,
    cycling: 0,
  };

  const exerciseTypes = [
    { key: 'pullUps', name: '引体', value: todayExercise.pullUps, unit: '个', color: 'blue' },
    { key: 'squats', name: '深蹲', value: todayExercise.squats, unit: '个', color: 'green' },
    { key: 'pushUps', name: '俯卧撑', value: todayExercise.pushUps, unit: '个', color: 'orange' },
    { key: 'running', name: '跑步', value: todayExercise.running, unit: 'km', color: 'red' },
    { key: 'swimming', name: '游泳', value: todayExercise.swimming, unit: 'km', color: 'cyan' },
    { key: 'cycling', name: '骑行', value: todayExercise.cycling, unit: 'km', color: 'purple' },
  ];

  const totalExercises = exerciseTypes.reduce((sum, exercise) => sum + exercise.value, 0);

  return (
    <Card h="full">
      <CardHeader pb={2}>
        <HStack justify="space-between">
          <HStack>
            <Activity size={20} />
            <Heading size="md">运动统计</Heading>
          </HStack>
          <IconButton
            aria-label="添加运动"
            icon={<Plus />}
            size="sm"
            variant="ghost"
          />
        </HStack>
      </CardHeader>
      
      <CardBody pt={2}>
        <VStack spacing={4} align="stretch">
          {/* 运动数据网格 */}
          <Grid templateColumns="repeat(3, 1fr)" gap={3}>
            {exerciseTypes.slice(0, 6).map((exercise) => (
              <GridItem key={exercise.key}>
                <VStack
                  p={3}
                  bg="gray.50"
                  _dark={{ bg: 'gray.700' }}
                  rounded="lg"
                  spacing={1}
                  textAlign="center"
                >
                  <Text fontSize="xl" fontWeight="bold" color={`${exercise.color}.500`}>
                    {exercise.value}
                  </Text>
                  <Text fontSize="xs" color="gray.600" _dark={{ color: 'gray.400' }}>
                    {exercise.name}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {exercise.unit}
                  </Text>
                </VStack>
              </GridItem>
            ))}
          </Grid>

          {/* 感受记录 */}
          <Box>
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={2}>
              感受
            </Text>
            <Box
              p={3}
              bg="gray.50"
              _dark={{ bg: 'gray.700' }}
              rounded="md"
              minH="60px"
            >
              <Text fontSize="sm" color="gray.500">
                {todayExercise.feeling || '今天还没有记录运动感受...'}
              </Text>
            </Box>
          </Box>

          {/* 运动类型标签 */}
          <HStack spacing={2} flexWrap="wrap">
            <Badge colorScheme="green" variant="subtle">
              有氧运动
            </Badge>
            <Badge colorScheme="blue" variant="subtle">
              力量训练
            </Badge>
            <Badge colorScheme="orange" variant="subtle">
              核心训练
            </Badge>
          </HStack>

          {/* 统计信息 */}
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
              今日运动量
            </Text>
            <HStack>
              <TrendingUp size={16} />
              <Text fontSize="sm" fontWeight="medium">
                {totalExercises > 0 ? '已运动' : '未运动'}
              </Text>
            </HStack>
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
}
