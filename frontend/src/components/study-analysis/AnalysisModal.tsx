'use client';

import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Button,
  VStack,
  HStack,
  Box,
  Text,
  Progress,
  Grid,
  GridItem,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Divider,
  Badge,
  List,
  ListItem,
} from '@chakra-ui/react';
import { StudyAnalysisResponse } from '@/hooks/useStudyAnalysis';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: StudyAnalysisResponse | null;
  loading: boolean;
}

export function AnalysisModal({ isOpen, onClose, analysis, loading }: AnalysisModalProps) {
  if (!analysis) {
    return null;
  }

  const { summary, healthScore, bySubject, insights, recommendations } = analysis;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>学习情况分析</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={6} align="stretch">
            {/* 总体统计 */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                总体统计
              </Text>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <GridItem>
                  <Stat>
                    <StatLabel>总学习时长</StatLabel>
                    <StatNumber>{Math.floor(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}m</StatNumber>
                  </Stat>
                </GridItem>
                <GridItem>
                  <Stat>
                    <StatLabel>学习次数</StatLabel>
                    <StatNumber>{summary.totalSessions}</StatNumber>
                  </Stat>
                </GridItem>
                <GridItem>
                  <Stat>
                    <StatLabel>平均时长</StatLabel>
                    <StatNumber>{summary.averageSessionDuration}分钟</StatNumber>
                  </Stat>
                </GridItem>
                <GridItem>
                  <Stat>
                    <StatLabel>坚持度</StatLabel>
                    <StatNumber>{summary.consistencyScore}%</StatNumber>
                  </Stat>
                </GridItem>
              </Grid>
            </Box>

            <Divider />

            {/* 健康分数 */}
            <Box>
              <Text fontSize="lg" fontWeight="bold" mb={4}>
                学习健康分数
              </Text>
              <VStack spacing={4} align="stretch">
                <Box>
                  <HStack justify="space-between" mb={2}>
                    <Text fontWeight="bold">总体评分</Text>
                    <Badge colorScheme={healthScore.score >= 70 ? 'green' : healthScore.score >= 50 ? 'yellow' : 'red'}>
                      {healthScore.score}分
                    </Badge>
                  </HStack>
                  <Progress value={healthScore.score} colorScheme={healthScore.score >= 70 ? 'green' : 'yellow'} />
                </Box>

                <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      坚持度
                    </Text>
                    <Progress value={healthScore.factors.consistency} colorScheme="blue" mb={1} />
                    <Text fontSize="sm" fontWeight="bold">
                      {healthScore.factors.consistency}%
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      学习时长
                    </Text>
                    <Progress value={healthScore.factors.duration} colorScheme="purple" mb={1} />
                    <Text fontSize="sm" fontWeight="bold">
                      {healthScore.factors.duration}%
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      学科多样性
                    </Text>
                    <Progress value={healthScore.factors.variety} colorScheme="cyan" mb={1} />
                    <Text fontSize="sm" fontWeight="bold">
                      {healthScore.factors.variety}%
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      学习效率
                    </Text>
                    <Progress value={healthScore.factors.efficiency} colorScheme="orange" mb={1} />
                    <Text fontSize="sm" fontWeight="bold">
                      {healthScore.factors.efficiency}%
                    </Text>
                  </Box>
                </Grid>
              </VStack>
            </Box>

            <Divider />

            {/* 学科分布 */}
            {bySubject.length > 0 && (
              <Box>
                <Text fontSize="lg" fontWeight="bold" mb={4}>
                  学科分布
                </Text>
                <VStack spacing={3} align="stretch">
                  {bySubject.map((item) => (
                    <Box key={item.subject}>
                      <HStack justify="space-between" mb={1}>
                        <Text fontWeight="medium">{item.subject}</Text>
                        <Text fontSize="sm" color="gray.600">
                          {item.minutes}分钟 ({item.percentage}%)
                        </Text>
                      </HStack>
                      <Progress value={item.percentage} colorScheme="teal" />
                    </Box>
                  ))}
                </VStack>
              </Box>
            )}

            <Divider />

            {/* 洞察 */}
            {insights && insights.length > 0 && (
              <Box>
                <Text fontSize="lg" fontWeight="bold" mb={4}>
                  学习洞察
                </Text>
                <List spacing={2}>
                  {insights.map((insight, idx) => (
                    <ListItem key={idx} pl={4}>
                      <Text>• {insight}</Text>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* 建议 */}
            {recommendations && recommendations.length > 0 && (
              <Box>
                <Text fontSize="lg" fontWeight="bold" mb={4}>
                  改进建议
                </Text>
                <List spacing={2}>
                  {recommendations.map((rec, idx) => (
                    <ListItem key={idx} pl={4}>
                      <Text color="blue.600">• {rec}</Text>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
