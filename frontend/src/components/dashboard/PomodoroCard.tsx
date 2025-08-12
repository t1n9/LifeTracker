'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Progress,
  IconButton,
  useToast,
} from '@chakra-ui/react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store/app';

export default function PomodoroCard() {
  const {
    pomodoro,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    stopPomodoro,
    updatePomodoroTime,
  } = useAppStore();

  const toast = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (pomodoro.isRunning && pomodoro.timeLeft > 0) {
      interval = setInterval(() => {
        updatePomodoroTime(pomodoro.timeLeft - 1);
      }, 1000);
    } else if (pomodoro.isRunning && pomodoro.timeLeft === 0) {
      // 番茄钟结束
      stopPomodoro();
      toast({
        title: '番茄钟完成！',
        description: '恭喜你完成了一个专注时段，休息一下吧！',
        status: 'success',
        duration: 5000,
      });
    }

    return () => clearInterval(interval);
  }, [pomodoro.isRunning, pomodoro.timeLeft, updatePomodoroTime, stopPomodoro, toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((pomodoro.duration - pomodoro.timeLeft) / pomodoro.duration) * 100;

  const handleStart = () => {
    if (pomodoro.timeLeft === pomodoro.duration) {
      startPomodoro();
    } else {
      resumePomodoro();
    }
  };

  const handleReset = () => {
    stopPomodoro();
  };

  return (
    <Card h="full">
      <CardHeader pb={2}>
        <Heading size="md" textAlign="center">
          番茄时钟
        </Heading>
      </CardHeader>
      
      <CardBody pt={2}>
        <VStack spacing={6} align="center" h="full" justify="center">
          {/* 时间显示和进度条 */}
          <VStack spacing={4}>
            <Box
              w="120px"
              h="120px"
              borderRadius="full"
              bg="gray.100"
              _dark={{ bg: 'gray.700' }}
              display="flex"
              alignItems="center"
              justifyContent="center"
              position="relative"
            >
              <VStack spacing={0}>
                <Text fontSize="xl" fontWeight="bold">
                  {formatTime(pomodoro.timeLeft)}
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {pomodoro.type === 'work' ? '专注' : '休息'}
                </Text>
              </VStack>
            </Box>

            <Box w="full" maxW="200px">
              <Progress
                value={progress}
                colorScheme="red"
                size="lg"
                borderRadius="full"
              />
            </Box>
          </VStack>

          {/* 控制按钮 */}
          <HStack spacing={4}>
            <IconButton
              aria-label={pomodoro.isRunning ? '暂停' : '开始'}
              icon={pomodoro.isRunning ? <Pause /> : <Play />}
              onClick={pomodoro.isRunning ? pausePomodoro : handleStart}
              colorScheme="green"
              size="lg"
              isRound
            />
            
            <IconButton
              aria-label="停止"
              icon={<Square />}
              onClick={handleReset}
              colorScheme="red"
              variant="outline"
              size="lg"
              isRound
              isDisabled={!pomodoro.isRunning && pomodoro.timeLeft === pomodoro.duration}
            />
            
            <IconButton
              aria-label="重置"
              icon={<RotateCcw />}
              onClick={handleReset}
              variant="ghost"
              size="lg"
              isRound
            />
          </HStack>

          {/* 状态信息 */}
          <VStack spacing={1} textAlign="center">
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
              {pomodoro.isRunning ? '专注中...' : '准备开始'}
            </Text>
            {pomodoro.currentTask && (
              <Text fontSize="xs" color="gray.500">
                绑定任务: {pomodoro.currentTask}
              </Text>
            )}
          </VStack>
        </VStack>
      </CardBody>
    </Card>
  );
}
