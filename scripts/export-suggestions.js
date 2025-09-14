#!/usr/bin/env node

/**
 * 导出系统建议的命令行工具
 * 使用方法：node scripts/export-suggestions.js [--format=csv|json] [--output=filename]
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 解析命令行参数
const args = process.argv.slice(2);
const format = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'csv';
const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

// 状态映射
const statusMap = {
  'pending': '待处理',
  'reviewed': '已审核',
  'implemented': '已实现',
  'rejected': '已拒绝'
};

const priorityMap = {
  'low': '低',
  'medium': '中',
  'high': '高',
  'urgent': '紧急'
};

const categoryMap = {
  'bug': 'Bug反馈',
  'feature': '功能建议',
  'improvement': '改进建议',
  'other': '其他'
};

async function exportSuggestions() {
  try {
    console.log('🔍 正在获取所有系统建议...');
    
    const suggestions = await prisma.systemSuggestion.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 找到 ${suggestions.length} 条建议`);

    if (suggestions.length === 0) {
      console.log('❌ 没有找到任何建议');
      return;
    }

    // 转换数据格式
    const exportData = suggestions.map(suggestion => ({
      建议ID: suggestion.id,
      标题: suggestion.title,
      内容: suggestion.content,
      状态: statusMap[suggestion.status] || suggestion.status,
      优先级: priorityMap[suggestion.priority] || suggestion.priority,
      分类: categoryMap[suggestion.category] || suggestion.category,
      提交者: suggestion.user.name,
      提交者邮箱: suggestion.user.email,
      提交时间: suggestion.createdAt.toLocaleString('zh-CN'),
      管理员回复: suggestion.adminReply || '无',
      审核时间: suggestion.reviewedAt ? suggestion.reviewedAt.toLocaleString('zh-CN') : '未审核',
      审核者: suggestion.reviewer?.name || '无'
    }));

    // 生成文件名
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = outputFile || `系统建议_${timestamp}.${format}`;
    const filepath = path.resolve(filename);

    if (format === 'json') {
      // 导出JSON格式
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2), 'utf8');
    } else {
      // 导出CSV格式
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => `"${String(row[header]).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');
      
      fs.writeFileSync(filepath, '\ufeff' + csvContent, 'utf8');
    }

    console.log(`✅ 建议已导出到: ${filepath}`);
    console.log(`📄 格式: ${format.toUpperCase()}`);
    console.log(`📊 总数: ${suggestions.length} 条`);

    // 显示统计信息
    const stats = {
      pending: suggestions.filter(s => s.status === 'pending').length,
      reviewed: suggestions.filter(s => s.status === 'reviewed').length,
      implemented: suggestions.filter(s => s.status === 'implemented').length,
      rejected: suggestions.filter(s => s.status === 'rejected').length,
    };

    console.log('\n📈 统计信息:');
    console.log(`   待处理: ${stats.pending}`);
    console.log(`   已审核: ${stats.reviewed}`);
    console.log(`   已实现: ${stats.implemented}`);
    console.log(`   已拒绝: ${stats.rejected}`);

  } catch (error) {
    console.error('❌ 导出失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 显示帮助信息
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📋 系统建议导出工具

使用方法:
  node scripts/export-suggestions.js [选项]

选项:
  --format=csv|json    导出格式 (默认: csv)
  --output=filename    输出文件名 (默认: 系统建议_日期.格式)
  --help, -h          显示帮助信息

示例:
  node scripts/export-suggestions.js
  node scripts/export-suggestions.js --format=json
  node scripts/export-suggestions.js --format=csv --output=suggestions.csv
`);
  process.exit(0);
}

// 执行导出
exportSuggestions();
