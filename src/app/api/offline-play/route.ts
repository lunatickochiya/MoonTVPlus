import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { offlineDownloadManager } from '@/lib/offline-download-manager';
import fs from 'fs';
import path from 'path';

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

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const videoId = searchParams.get('videoId');
    const episodeIndex = searchParams.get('episodeIndex');

    if (!source || !videoId || !episodeIndex) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    const episodeNum = parseInt(episodeIndex, 10);
    if (isNaN(episodeNum)) {
      return NextResponse.json(
        { error: '无效的集数' },
        { status: 400 }
      );
    }

    // 检查离线视频是否存在
    const offlineVideoPath = await offlineDownloadManager.getOfflineVideo(
      source,
      videoId,
      episodeNum
    );

    if (!offlineVideoPath) {
      return NextResponse.json(
        { error: '离线视频不存在' },
        { status: 404 }
      );
    }

    // 读取并返回视频文件
    const videoData = fs.readFileSync(offlineVideoPath);
    const ext = path.extname(offlineVideoPath).toLowerCase();

    let contentType = 'video/mp2t'; // TS 格式
    if (ext === '.mp4') {
      contentType = 'video/mp4';
    } else if (ext === '.webm') {
      contentType = 'video/webm';
    } else if (ext === '.mkv') {
      contentType = 'video/x-matroska';
    }

    return new NextResponse(videoData, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': videoData.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('离线播放 API 错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
