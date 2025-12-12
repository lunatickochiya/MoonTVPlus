import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { offlineDownloadManager } from '@/lib/offline-download-manager';

export async function POST(request: NextRequest) {
  try {
    // 检查是否启用离线下载功能
    const offlineDownloadEnabled = process.env.ENABLE_OFFLINE_DOWNLOAD === 'true';
    if (!offlineDownloadEnabled) {
      return NextResponse.json(
        { error: '离线下载功能未启用' },
        { status: 403 }
      );
    }

    // 检查用户权限
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    // 只有管理员和站长可以使用离线下载
    const userRole = authInfo.username === process.env.USERNAME ? 'owner' : 'admin';
    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，只有管理员和站长可以使用离线下载功能' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: '无效的任务列表' },
        { status: 400 }
      );
    }

    // 添加下载任务
    let successCount = 0;
    let failCount = 0;

    for (const task of tasks) {
      try {
        await offlineDownloadManager.addTask({
          url: task.url,
          source: task.source,
          videoId: task.videoId,
          videoTitle: task.videoTitle,
          episodeIndex: task.episodeIndex,
        });
        successCount++;
      } catch (error) {
        console.error('添加离线下载任务失败:', error);
        failCount++;
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failCount,
      message: `成功添加 ${successCount} 个任务，失败 ${failCount} 个`,
    });
  } catch (error) {
    console.error('离线下载 API 错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 获取离线下载任务列表
export async function GET(request: NextRequest) {
  try {
    // 检查是否启用离线下载功能
    const offlineDownloadEnabled = process.env.ENABLE_OFFLINE_DOWNLOAD === 'true';
    if (!offlineDownloadEnabled) {
      return NextResponse.json(
        { error: '离线下载功能未启用' },
        { status: 403 }
      );
    }

    // 检查用户权限
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    // 只有管理员和站长可以使用离线下载
    const userRole = authInfo.username === process.env.USERNAME ? 'owner' : 'admin';
    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，只有管理员和站长可以使用离线下载功能' },
        { status: 403 }
      );
    }

    const tasks = offlineDownloadManager.getTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('获取离线下载任务列表错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 删除离线下载任务
export async function DELETE(request: NextRequest) {
  try {
    // 检查是否启用离线下载功能
    const offlineDownloadEnabled = process.env.ENABLE_OFFLINE_DOWNLOAD === 'true';
    if (!offlineDownloadEnabled) {
      return NextResponse.json(
        { error: '离线下载功能未启用' },
        { status: 403 }
      );
    }

    // 检查用户权限
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    // 只有管理员和站长可以使用离线下载
    const userRole = authInfo.username === process.env.USERNAME ? 'owner' : 'admin';
    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，只有管理员和站长可以使用离线下载功能' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: '缺少任务ID' },
        { status: 400 }
      );
    }

    await offlineDownloadManager.deleteTask(taskId);
    return NextResponse.json({ message: '任务已删除' });
  } catch (error) {
    console.error('删除离线下载任务错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 重试离线下载任务
export async function PUT(request: NextRequest) {
  try {
    // 检查是否启用离线下载功能
    const offlineDownloadEnabled = process.env.ENABLE_OFFLINE_DOWNLOAD === 'true';
    if (!offlineDownloadEnabled) {
      return NextResponse.json(
        { error: '离线下载功能未启用' },
        { status: 403 }
      );
    }

    // 检查用户权限
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    // 只有管理员和站长可以使用离线下载
    const userRole = authInfo.username === process.env.USERNAME ? 'owner' : 'admin';
    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json(
        { error: '权限不足，只有管理员和站长可以使用离线下载功能' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: '缺少任务ID' },
        { status: 400 }
      );
    }

    await offlineDownloadManager.retryTask(taskId);
    return NextResponse.json({ message: '任务已重新开始' });
  } catch (error) {
    console.error('重试离线下载任务错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}
