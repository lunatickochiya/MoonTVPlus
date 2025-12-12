import { getConfig } from '@/lib/config';

/**
 * 默认去广告规则
 */
export function filterAdsFromM3U8Default(type: string, m3u8Content: string): string {
  if (!m3u8Content) return '';

  // 按行分割M3U8内容
  const lines = m3u8Content.split('\n');
  const filteredLines = [];

  let nextdelete = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (nextdelete) {
      nextdelete = false;
      continue;
    }

    // 只过滤#EXT-X-DISCONTINUITY标识
    if (!line.includes('#EXT-X-DISCONTINUITY')) {
      if (
        type === 'ruyi' &&
        (line.includes('EXTINF:5.640000') ||
          line.includes('EXTINF:2.960000') ||
          line.includes('EXTINF:3.480000') ||
          line.includes('EXTINF:4.000000') ||
          line.includes('EXTINF:0.960000') ||
          line.includes('EXTINF:10.000000') ||
          line.includes('EXTINF:1.266667'))
      ) {
        nextdelete = true;
        continue;
      }

      filteredLines.push(line);
    }
  }

  return filteredLines.join('\n');
}

/**
 * 执行 M3U8 去广告逻辑
 * @param source 播放源类型
 * @param m3u8Content M3U8 内容
 * @returns 去广告后的 M3U8 内容
 */
export async function applyAdFilter(source: string, m3u8Content: string): Promise<string> {
  try {
    const config = await getConfig();
    const customAdFilterCode = config.SiteConfig?.CustomAdFilterCode || '';

    if (customAdFilterCode && customAdFilterCode.trim()) {
      try {
        // 移除 TypeScript 类型注解,转换为纯 JavaScript
        const jsCode = customAdFilterCode
          .replace(/(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*([,)])/g, '$1$3')
          .replace(/\)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*\{/g, ') {')
          .replace(/(const|let|var)\s+(\w+)\s*:\s*(string|number|boolean|any|void|never|unknown|object)\s*=/g, '$1 $2 =');

        // 创建并执行自定义函数
        const customFunction = new Function('type', 'm3u8Content',
          jsCode + '\nreturn filterAdsFromM3U8(type, m3u8Content);'
        );
        return customFunction(source, m3u8Content);
      } catch (err) {
        console.error('执行自定义去广告代码失败,使用默认规则:', err);
        // 继续使用默认规则
        return filterAdsFromM3U8Default(source, m3u8Content);
      }
    } else {
      // 使用默认去广告规则
      return filterAdsFromM3U8Default(source, m3u8Content);
    }
  } catch (error) {
    console.error('去广告处理失败:', error);
    // 出错返回原内容
    return m3u8Content;
  }
}
