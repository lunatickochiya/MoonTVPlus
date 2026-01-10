/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from 'next/server';

import { embyManager } from '@/lib/emby-manager';
import { getCachedEmbyList, setCachedEmbyList } from '@/lib/emby-cache';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const parentId = searchParams.get('parentId') || undefined;
  const embyKey = searchParams.get('embyKey') || undefined;

  try {
    // 检查缓存
    const cached = getCachedEmbyList(page, pageSize, parentId, embyKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 获取Emby客户端
    const client = await embyManager.getClient(embyKey);

    // 获取媒体列表
    const result = await client.getItems({
      ParentId: parentId,
      IncludeItemTypes: 'Movie,Series',
      Recursive: true,
      Fields: 'Overview,ProductionYear',
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      StartIndex: (page - 1) * pageSize,
      Limit: pageSize,
    });

    const list = result.Items.map((item) => ({
      id: item.Id,
      title: item.Name,
      poster: client.getImageUrl(item.Id, 'Primary'),
      year: item.ProductionYear?.toString() || '',
      rating: item.CommunityRating || 0,
      mediaType: item.Type === 'Movie' ? 'movie' : 'tv',
    }));

    const totalPages = Math.ceil(result.TotalRecordCount / pageSize);

    const response = {
      success: true,
      list,
      totalPages,
      currentPage: page,
      total: result.TotalRecordCount,
    };

    // 缓存结果
    setCachedEmbyList(page, pageSize, response, parentId, embyKey);

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取 Emby 列表失败:', error);
    return NextResponse.json({
      error: '获取 Emby 列表失败: ' + (error as Error).message,
      list: [],
      totalPages: 0,
      currentPage: page,
      total: 0,
    });
  }
}
