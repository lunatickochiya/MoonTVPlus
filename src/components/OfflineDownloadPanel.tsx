'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { OfflineDownloadTask } from '@/lib/offline-download-manager';

interface OfflineDownloadPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OfflineDownloadPanel({ isOpen, onClose }: OfflineDownloadPanelProps) {
  const [tasks, setTasks] = useState<OfflineDownloadTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTasks();
      // 每2秒刷新一次任务列表
      const interval = setInterval(fetchTasks, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/offline-download');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('获取离线下载任务失败:', error);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/offline-download?taskId=${taskId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTasks();
      } else {
        const data = await response.json();
        alert('删除失败：' + data.error);
      }
    } catch (error) {
      console.error('删除任务失败:', error);
      alert('删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (taskId: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/offline-download', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });

      if (response.ok) {
        await fetchTasks();
      } else {
        const data = await response.json();
        alert('重试失败：' + data.error);
      }
    } catch (error) {
      console.error('重试任务失败:', error);
      alert('重试失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) {
    return null;
  }

  const getStatusText = (status: OfflineDownloadTask['status']) => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'downloading':
        return '下载中';
      case 'completed':
        return '已完成';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  const getStatusColor = (status: OfflineDownloadTask['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-500';
      case 'downloading':
        return 'text-blue-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  const panel = (
    <div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
      <div className='bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] md:max-h-[80vh] flex flex-col'>
        {/* 标题栏 */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center gap-2'>
            <svg
              className='w-6 h-6 text-blue-600 dark:text-blue-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01'
              />
            </svg>
            <h2 className='text-xl font-bold text-gray-900 dark:text-white'>离线下载任务</h2>
          </div>
          <button
            onClick={onClose}
            className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        {/* 任务列表 */}
        <div className='flex-1 overflow-y-auto p-4 space-y-3'>
          {tasks.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400'>
              <svg className='w-16 h-16 mb-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01'
                />
              </svg>
              <p className='text-lg'>暂无离线下载任务</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className='bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600'
              >
                {/* 任务信息 */}
                <div className='flex items-start justify-between mb-3'>
                  <div className='flex-1 min-w-0'>
                    <h3 className='text-sm font-medium text-gray-900 dark:text-white mb-1'>
                      {task.videoTitle} - 第{task.episodeIndex}集
                    </h3>
                    <div className='flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
                      <span>来源: {task.source}</span>
                      <span>•</span>
                      <span>创建: {formatDate(task.createdAt)}</span>
                    </div>
                  </div>
                  <div className='flex items-center gap-2 ml-4'>
                    <span className={`text-xs font-medium ${getStatusColor(task.status)}`}>
                      {getStatusText(task.status)}
                    </span>
                  </div>
                </div>

                {/* 进度条 */}
                {task.status !== 'completed' && (
                  <div className='mb-3'>
                    <div className='flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1'>
                      <span>
                        {task.totalSize > 0 && task.downloadedSize > 0
                          ? `${task.downloadedSize} / ${task.totalSize} ${task.url.includes('.m3u8') ? '片段' : ''}`
                          : '准备中...'}
                      </span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className='w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden'>
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          task.status === 'downloading'
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 animate-pulse'
                            : task.status === 'error'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                        }`}
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* 已完成显示文件信息 */}
                {task.status === 'completed' && task.filePath && (
                  <div className='mb-3 flex items-center gap-2 text-xs text-green-600 dark:text-green-400'>
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                      />
                    </svg>
                    <span>已保存到服务器</span>
                  </div>
                )}

                {/* 错误信息 */}
                {task.status === 'error' && task.error && (
                  <div className='mb-3 text-xs text-red-500 dark:text-red-400'>
                    错误: {task.error}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className='flex items-center gap-2'>
                  {/* 重试按钮 - 仅在错误状态显示 */}
                  {task.status === 'error' && (
                    <button
                      onClick={() => handleRetry(task.id)}
                      disabled={loading}
                      className='flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50'
                    >
                      <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                        />
                      </svg>
                      重试
                    </button>
                  )}

                  {/* 删除按钮 */}
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={loading}
                    className='flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50'
                  >
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                      />
                    </svg>
                    删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 底部统计 */}
        {tasks.length > 0 && (
          <div className='p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'>
            <div className='flex items-center justify-between text-sm text-gray-600 dark:text-gray-300'>
              <span>总任务数: {tasks.length}</span>
              <span>下载中: {tasks.filter((t) => t.status === 'downloading').length}</span>
              <span>已完成: {tasks.filter((t) => t.status === 'completed').length}</span>
              <span>错误: {tasks.filter((t) => t.status === 'error').length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
