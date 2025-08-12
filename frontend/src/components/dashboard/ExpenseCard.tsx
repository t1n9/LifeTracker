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
  Divider,
} from '@chakra-ui/react';
import { DollarSign, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { healthAPI } from '@/lib/api';

export default function ExpenseCard() {
  const { data: expenseData } = useQuery({
    queryKey: ['expense-records'],
    queryFn: () => healthAPI.getExpenseRecords(1),
  });

  const todayExpense = expenseData?.data?.[0] || {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    total: 0,
    other: [],
  };

  const expenseCategories = [
    { key: 'breakfast', name: '早餐', value: todayExpense.breakfast, color: 'orange' },
    { key: 'lunch', name: '午餐', value: todayExpense.lunch, color: 'green' },
    { key: 'dinner', name: '晚餐', value: todayExpense.dinner, color: 'blue' },
  ];

  const hasExpenses = todayExpense.total > 0;

  return (
    <Card h="full">
      <CardHeader pb={2}>
        <HStack justify="space-between">
          <HStack>
            <DollarSign size={20} />
            <Heading size="md">消费统计</Heading>
          </HStack>
          <IconButton
            aria-label="添加消费"
            icon={<Plus />}
            size="sm"
            variant="ghost"
          />
        </HStack>
      </CardHeader>
      
      <CardBody pt={2}>
        <VStack spacing={4} align="stretch">
          {/* 总消费金额 */}
          <Box textAlign="center">
            <Text fontSize="3xl" fontWeight="bold" color="brand.500">
              ¥{todayExpense.total.toFixed(2)}
            </Text>
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
              今日总消费
            </Text>
          </Box>

          <Divider />

          {/* 消费分类 */}
          <VStack spacing={3} align="stretch">
            {expenseCategories.map((category) => (
              <HStack key={category.key} justify="space-between">
                <HStack>
                  <Box
                    w={3}
                    h={3}
                    bg={`${category.color}.500`}
                    rounded="full"
                  />
                  <Text fontSize="sm">{category.name}</Text>
                </HStack>
                <Text fontSize="sm" fontWeight="medium">
                  ¥{category.value.toFixed(2)}
                </Text>
              </HStack>
            ))}
          </VStack>

          {/* 其他消费 */}
          {todayExpense.other && todayExpense.other.length > 0 && (
            <>
              <Divider />
              <VStack spacing={2} align="stretch">
                <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                  其他消费
                </Text>
                {todayExpense.other.slice(0, 2).map((item: any, index: number) => (
                  <HStack key={index} justify="space-between" fontSize="sm">
                    <Text>{item.description || '其他'}</Text>
                    <Text fontWeight="medium">¥{item.amount?.toFixed(2) || '0.00'}</Text>
                  </HStack>
                ))}
              </VStack>
            </>
          )}

          {/* 消费状态 */}
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
              消费状态
            </Text>
            <HStack>
              {hasExpenses ? (
                <>
                  <TrendingUp size={16} color="red" />
                  <Badge colorScheme="red" variant="subtle">
                    有支出
                  </Badge>
                </>
              ) : (
                <>
                  <TrendingDown size={16} color="green" />
                  <Badge colorScheme="green" variant="subtle">
                    无支出
                  </Badge>
                </>
              )}
            </HStack>
          </HStack>

          {/* 快捷添加按钮 */}
          <Grid templateColumns="repeat(3, 1fr)" gap={2}>
            <GridItem>
              <Button size="xs" variant="outline" colorScheme="orange" w="full">
                早餐
              </Button>
            </GridItem>
            <GridItem>
              <Button size="xs" variant="outline" colorScheme="green" w="full">
                午餐
              </Button>
            </GridItem>
            <GridItem>
              <Button size="xs" variant="outline" colorScheme="blue" w="full">
                晚餐
              </Button>
            </GridItem>
          </Grid>
        </VStack>
      </CardBody>
    </Card>
  );
}
