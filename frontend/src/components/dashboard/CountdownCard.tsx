'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  Heading,
  Text,
  VStack,
  HStack,
  Progress,
  Badge,
} from '@chakra-ui/react';
import { Calendar, Clock } from 'lucide-react';

export default function CountdownCard() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // 目标日期 - 雅思考试
  const targetDate = new Date('2025-08-27');
  const examDate = new Date('2025-12-20'); // 考研日期

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  // 计算进度百分比
  const startDate = new Date('2025-07-01'); // 开始记录的日期
  const totalDays = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const passedDays = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const progress = Math.min((passedDays / totalDays) * 100, 100);

  return (
    <Card
      bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      color="white"
      h="200px"
    >
      <CardBody p={6}>
        <VStack align="start" spacing={4} h="full">
          <HStack justify="space-between" w="full">
            <VStack align="start" spacing={1}>
              <HStack>
                <Calendar size={20} />
                <Heading size="md">考研倒计时</Heading>
              </HStack>
              <Text fontSize="sm" opacity={0.9}>
                距离雅思考试
              </Text>
            </VStack>
            <Badge colorScheme="whiteAlpha" variant="solid">
              目标达成
            </Badge>
          </HStack>

          <HStack spacing={8} flex={1} align="center">
            <VStack spacing={0}>
              <Text fontSize="3xl" fontWeight="bold">
                {timeLeft.days}
              </Text>
              <Text fontSize="sm" opacity={0.8}>
                天
              </Text>
            </VStack>
            
            <VStack spacing={0}>
              <Text fontSize="2xl" fontWeight="bold">
                {String(timeLeft.hours).padStart(2, '0')}:
                {String(timeLeft.minutes).padStart(2, '0')}
              </Text>
              <Text fontSize="sm" opacity={0.8}>
                时:分
              </Text>
            </VStack>

            <VStack align="end" spacing={2} flex={1}>
              <HStack>
                <Text fontSize="sm">8月12日</Text>
                <Text fontSize="sm">12月20日</Text>
              </HStack>
              <Text fontSize="xs" opacity={0.8}>
                雅思考试
              </Text>
              <Text fontSize="xs" opacity={0.8}>
                考研日期
              </Text>
            </VStack>
          </HStack>

          <Box w="full">
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" opacity={0.9}>
                学习进度
              </Text>
              <Text fontSize="sm" opacity={0.9}>
                {Math.round(progress)}%
              </Text>
            </HStack>
            <Progress
              value={progress}
              colorScheme="whiteAlpha"
              bg="whiteAlpha.300"
              borderRadius="full"
              size="sm"
            />
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}
