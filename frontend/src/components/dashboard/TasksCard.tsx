'use client';

import { useState } from 'react';
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
  Checkbox,
  IconButton,
  Button,
  Badge,
  Divider,
} from '@chakra-ui/react';
import { CheckSquare, Plus, Play } from 'lucide-react';
import { taskAPI } from '@/lib/api';
import { useAppStore } from '@/store/app';

export default function TasksCard() {
  const { startPomodoro } = useAppStore();
  
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskAPI.getTasks(),
  });

  const tasks = tasksData?.data || [];
  const pendingTasks = tasks.filter((task: any) => !task.isCompleted);
  const completedTasks = tasks.filter((task: any) => task.isCompleted);

  const handleStartPomodoro = (taskId: string) => {
    startPomodoro(taskId);
  };

  return (
    <Card h="full">
      <CardHeader pb={2}>
        <HStack justify="space-between">
          <HStack>
            <CheckSquare size={20} />
            <Heading size="md">待办任务</Heading>
          </HStack>
          <Badge colorScheme="blue" variant="subtle">
            {pendingTasks.length}
          </Badge>
        </HStack>
      </CardHeader>
      
      <CardBody pt={2}>
        <VStack spacing={3} align="stretch" h="full">
          {/* 任务列表 */}
          <Box flex={1} overflowY="auto" maxH="200px">
            {pendingTasks.length === 0 ? (
              <Text
                fontSize="sm"
                color="gray.500"
                textAlign="center"
                py={4}
              >
                暂无待办任务
              </Text>
            ) : (
              <VStack spacing={2} align="stretch">
                {pendingTasks.slice(0, 3).map((task: any) => (
                  <HStack
                    key={task.id}
                    p={2}
                    bg="gray.50"
                    _dark={{ bg: 'gray.700' }}
                    rounded="md"
                    justify="space-between"
                  >
                    <HStack flex={1} spacing={2}>
                      <Checkbox size="sm" />
                      <VStack align="start" spacing={0} flex={1}>
                        <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                          {task.title}
                        </Text>
                        {task.subject && (
                          <Text fontSize="xs" color="gray.500">
                            {task.subject}
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                    
                    <IconButton
                      aria-label="开始番茄钟"
                      icon={<Play />}
                      size="xs"
                      variant="ghost"
                      onClick={() => handleStartPomodoro(task.id)}
                    />
                  </HStack>
                ))}
                
                {pendingTasks.length > 3 && (
                  <Text fontSize="xs" color="gray.500" textAlign="center">
                    还有 {pendingTasks.length - 3} 个任务...
                  </Text>
                )}
              </VStack>
            )}
          </Box>

          {/* 已完成任务统计 */}
          {completedTasks.length > 0 && (
            <>
              <Divider />
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                  已完成
                </Text>
                <Badge colorScheme="green" variant="subtle">
                  {completedTasks.length}
                </Badge>
              </HStack>
            </>
          )}

          {/* 添加任务按钮 */}
          <Button
            leftIcon={<Plus />}
            size="sm"
            variant="outline"
            colorScheme="brand"
          >
            添加任务
          </Button>
        </VStack>
      </CardBody>
    </Card>
  );
}
