import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { promisify } from 'util';
import crypto from 'crypto';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface OfflineDownloadTask {
  id: string;
  url: string;
  source: string;
  videoId: string;
  videoTitle: string;
  episodeIndex: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  totalSize: number;
  downloadedSize: number;
  error?: string;
  createdAt: number;
  filePath?: string;
  fileName: string;
}

class OfflineDownloadManager {
  private tasks: Map<string, OfflineDownloadTask> = new Map();
  private downloadDir: string;
  private metadataFile: string;
  private activeDownloads: Map<string, AbortController> = new Map();

  constructor() {
    this.downloadDir = process.env.OFFLINE_DOWNLOAD_DIR || path.join(process.cwd(), 'downloads');
    this.metadataFile = path.join(this.downloadDir, 'metadata.json');
    this.init();
  }

  private async init() {
    try {
      // 确保下载目录存在
      await mkdir(this.downloadDir, { recursive: true });

      // 加载任务元数据
      if (fs.existsSync(this.metadataFile)) {
        const data = await readFile(this.metadataFile, 'utf-8');
        const tasks = JSON.parse(data) as OfflineDownloadTask[];
        tasks.forEach((task) => {
          this.tasks.set(task.id, task);
          // 重启未完成的下载
          if (task.status === 'downloading' || task.status === 'pending') {
            task.status = 'pending';
            this.startDownload(task.id);
          }
        });
      }
    } catch (error) {
      console.error('初始化离线下载管理器失败:', error);
    }
  }

  private async saveMetadata() {
    try {
      const tasks = Array.from(this.tasks.values());
      await writeFile(this.metadataFile, JSON.stringify(tasks, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存元数据失败:', error);
    }
  }

  private generateFileName(source: string, videoId: string, episodeIndex: number): string {
    return `${source}_${videoId}_${episodeIndex}.ts`;
  }

  async addTask(taskData: {
    url: string;
    source: string;
    videoId: string;
    videoTitle: string;
    episodeIndex: number;
  }): Promise<string> {
    // 检查是否已存在相同的任务（去重）
    const existingTask = Array.from(this.tasks.values()).find(
      (task) =>
        task.source === taskData.source &&
        task.videoId === taskData.videoId &&
        task.episodeIndex === taskData.episodeIndex
    );

    if (existingTask) {
      // 如果已存在且状态为 completed 或 downloading，返回现有任务 ID
      if (existingTask.status === 'completed' || existingTask.status === 'downloading' || existingTask.status === 'pending') {
        console.log(`任务已存在: ${existingTask.source}_${existingTask.videoId}_${existingTask.episodeIndex}，状态: ${existingTask.status}`);
        return existingTask.id;
      }
      // 如果是 error 状态，可以重新开始
    }

    const taskId = crypto.randomBytes(16).toString('hex');
    const fileName = this.generateFileName(taskData.source, taskData.videoId, taskData.episodeIndex);

    const task: OfflineDownloadTask = {
      id: taskId,
      url: taskData.url,
      source: taskData.source,
      videoId: taskData.videoId,
      videoTitle: taskData.videoTitle,
      episodeIndex: taskData.episodeIndex,
      status: 'pending',
      progress: 0,
      totalSize: 0,
      downloadedSize: 0,
      createdAt: Date.now(),
      fileName,
    };

    this.tasks.set(taskId, task);
    await this.saveMetadata();

    // 开始下载
    this.startDownload(taskId);

    return taskId;
  }

  private async startDownload(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      task.status = 'downloading';
      await this.saveMetadata();

      const isM3u8 = task.url.toLowerCase().includes('.m3u8');

      if (isM3u8) {
        await this.downloadM3u8(task);
      } else {
        await this.downloadFile(task);
      }

      task.status = 'completed';
      task.progress = 100;
      await this.saveMetadata();
    } catch (error) {
      console.error(`下载任务失败 (${taskId}):`, error);
      task.status = 'error';
      task.error = error instanceof Error ? error.message : '未知错误';
      await this.saveMetadata();
    }
  }

  private async downloadFile(task: OfflineDownloadTask) {
    const filePath = path.join(this.downloadDir, task.fileName);
    const controller = new AbortController();
    this.activeDownloads.set(task.id, controller);

    return new Promise<void>((resolve, reject) => {
      const client = task.url.startsWith('https') ? https : http;

      const request = client.get(task.url, { signal: controller.signal as any }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        task.totalSize = totalSize;

        const fileStream = fs.createWriteStream(filePath);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          task.downloadedSize = downloadedSize;
          task.progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          task.filePath = filePath;
          this.activeDownloads.delete(task.id);
          resolve();
        });

        fileStream.on('error', (error) => {
          fileStream.close();
          this.activeDownloads.delete(task.id);
          reject(error);
        });
      });

      request.on('error', (error) => {
        this.activeDownloads.delete(task.id);
        reject(error);
      });
    });
  }

  private async downloadM3u8(task: OfflineDownloadTask) {
    const controller = new AbortController();
    this.activeDownloads.set(task.id, controller);

    try {
      // 获取 M3U8 内容
      console.log(`[OfflineDownload] Fetching M3U8 from: ${task.url}`);
      let m3u8Content = await this.fetchContent(task.url);
      console.log(`[OfflineDownload] M3U8 content length: ${m3u8Content.length}`);

      // 检查是否是 master playlist（包含多个清晰度选项）
      if (m3u8Content.includes('#EXT-X-STREAM-INF')) {
        console.log(`[OfflineDownload] Detected master playlist, need to fetch media playlist`);

        // 解析第一个 media playlist URL
        const lines = m3u8Content.split('\n');
        let mediaPlaylistUrl: string | null = null;
        let isNextLineUrl = false;

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#EXT-X-STREAM-INF')) {
            isNextLineUrl = true;
            continue;
          }
          if (isNextLineUrl && trimmed && !trimmed.startsWith('#')) {
            mediaPlaylistUrl = trimmed;
            break;
          }
        }

        if (!mediaPlaylistUrl) {
          throw new Error('无法从 master playlist 中找到 media playlist URL');
        }

        // 解析 media playlist URL（处理相对路径）
        const m3u8Url = new URL(task.url);
        if (!mediaPlaylistUrl.startsWith('http://') && !mediaPlaylistUrl.startsWith('https://')) {
          if (mediaPlaylistUrl.startsWith('/')) {
            // 绝对路径（相对于域名）
            mediaPlaylistUrl = `${m3u8Url.protocol}//${m3u8Url.host}${mediaPlaylistUrl}`;
          } else {
            // 相对路径（相对于当前目录）
            // 使用 URL 构造器正确解析相对路径
            const baseUrl = task.url.substring(0, task.url.lastIndexOf('/') + 1);
            mediaPlaylistUrl = new URL(mediaPlaylistUrl, baseUrl).href;
          }
        }

        console.log(`[OfflineDownload] Fetching media playlist from: ${mediaPlaylistUrl}`);
        m3u8Content = await this.fetchContent(mediaPlaylistUrl);
        console.log(`[OfflineDownload] Media playlist content length: ${m3u8Content.length}`);

        // 更新 baseUrl 为 media playlist 的目录，用于后续解析 TS URLs
        task.url = mediaPlaylistUrl;
      }


      // 解析 M3U8，提取 TS 片段 URL 和加密信息
      const lines = m3u8Content.split('\n');
      const tsUrls: string[] = [];
      let aesKey: Buffer | null = null;
      let aesIV: Buffer | null = null;
      let aesMethod: string | null = null;

      // 使用 URL 对象正确解析基础路径
      const m3u8Url = new URL(task.url);
      const baseUrl = m3u8Url.href.substring(0, m3u8Url.href.lastIndexOf('/') + 1);

      // 解析加密信息
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#EXT-X-KEY:')) {
          const methodMatch = trimmed.match(/METHOD=([^,]+)/);
          const uriMatch = trimmed.match(/URI="([^"]+)"/);
          const ivMatch = trimmed.match(/IV=0x([0-9A-Fa-f]+)/);

          if (methodMatch) {
            aesMethod = methodMatch[1];
          }

          if (aesMethod && aesMethod !== 'NONE' && uriMatch) {
            let keyUrl = uriMatch[1];

            // 处理密钥 URL 的相对路径
            if (!keyUrl.startsWith('http://') && !keyUrl.startsWith('https://')) {
              if (keyUrl.startsWith('/')) {
                keyUrl = `${m3u8Url.protocol}//${m3u8Url.host}${keyUrl}`;
              } else {
                keyUrl = baseUrl + keyUrl;
              }
            }

            // 下载密钥
            console.log(`下载密钥: ${keyUrl}`);
            aesKey = await this.downloadSegmentToBuffer(keyUrl);

            // 解析 IV
            if (ivMatch) {
              aesIV = Buffer.from(ivMatch[1], 'hex');
            }
          }
        }
      }

      // 解析 TS 片段 URL
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          let tsUrl: string;

          // 处理绝对路径和相对路径
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            tsUrl = trimmed;
          } else if (trimmed.startsWith('/')) {
            tsUrl = `${m3u8Url.protocol}//${m3u8Url.host}${trimmed}`;
          } else {
            tsUrl = baseUrl + trimmed;
          }

          tsUrls.push(tsUrl);
        }
      }

      if (tsUrls.length === 0) {
        throw new Error('未找到视频片段');
      }

      console.log(`[OfflineDownload] Found ${tsUrls.length} TS segments`);
      console.log(`[OfflineDownload] First 3 TS URLs:`, tsUrls.slice(0, 3));
      console.log(`[OfflineDownload] Has encryption: ${aesKey ? 'YES' : 'NO'}, Method: ${aesMethod || 'NONE'}`);

      // 下载所有 TS 片段到内存
      task.totalSize = tsUrls.length;
      const segmentBuffers: Buffer[] = [];

      for (let i = 0; i < tsUrls.length; i++) {
        if (controller.signal.aborted) {
          throw new Error('下载已取消');
        }

        const tsUrl = tsUrls[i];
        console.log(`下载片段 ${i + 1}/${tsUrls.length}: ${tsUrl}`);

        let segmentBuffer = await this.downloadSegmentToBuffer(tsUrl);

        // AES 解密（如果需要）
        if (aesKey && aesMethod === 'AES-128') {
          segmentBuffer = this.decryptAES128(segmentBuffer, aesKey, aesIV, i);
        }

        segmentBuffers.push(segmentBuffer);

        task.downloadedSize = i + 1;
        task.progress = Math.round(((i + 1) / tsUrls.length) * 100);
        await this.saveMetadata();
      }

      // 合并所有 TS 片段
      console.log('合并 TS 片段...');
      const mergedBuffer = Buffer.concat(segmentBuffers);

      // 保存为单个文件（扩展名为 .ts，但实际可以当 mp4 播放）
      const videoFileName = `${task.source}_${task.videoId}_${task.episodeIndex}.ts`;
      const videoFilePath = path.join(this.downloadDir, videoFileName);
      await writeFile(videoFilePath, mergedBuffer);

      task.filePath = videoFilePath;
      console.log(`视频已保存: ${videoFilePath}`);

      this.activeDownloads.delete(task.id);
    } catch (error) {
      this.activeDownloads.delete(task.id);
      throw error;
    }
  }

  private decryptAES128(data: Buffer, key: Buffer, iv: Buffer | null, segmentIndex: number): Buffer {
    try {
      // 检查数据长度是否是 16 的倍数（AES 块大小）
      if (data.length % 16 !== 0) {
        console.warn(`片段 ${segmentIndex} 数据长度 ${data.length} 不是 16 的倍数，可能未加密，跳过解密`);
        return data;
      }

      // 如果没有指定 IV，使用片段索引作为 IV
      let ivBuffer: Buffer;
      if (iv) {
        ivBuffer = iv;
      } else {
        // 默认 IV：16 字节，前 12 字节为 0，后 4 字节为片段索引
        ivBuffer = Buffer.alloc(16);
        ivBuffer.writeUInt32BE(segmentIndex, 12);
      }

      const decipher = crypto.createDecipheriv('aes-128-cbc', key, ivBuffer);
      // 禁用自动 padding，因为 TS 流可能已经有自己的 padding
      decipher.setAutoPadding(false);
      return Buffer.concat([decipher.update(data), decipher.final()]);
    } catch (error) {
      console.error(`AES 解密失败 (片段 ${segmentIndex}):`, error);
      console.error(`数据长度: ${data.length}, 是否是16的倍数: ${data.length % 16 === 0}`);
      return data; // 解密失败，返回原始数据
    }
  }

  private fetchContent(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;

      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          resolve(data);
        });

        response.on('error', reject);
      }).on('error', reject);
    });
  }

  private async downloadSegmentToBuffer(url: string, retries = 3): Promise<Buffer> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await new Promise<Buffer>((resolve, reject) => {
          const client = url.startsWith('https') ? https : http;

          client.get(url, (response) => {
            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode}`));
              return;
            }

            const chunks: Buffer[] = [];

            response.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });

            response.on('end', () => {
              resolve(Buffer.concat(chunks));
            });

            response.on('error', reject);
          }).on('error', reject);
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < retries - 1) {
          // 等待后重试（指数退避）
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          console.log(`重试下载片段到内存 (${attempt + 1}/${retries}): ${url}`);
        }
      }
    }

    throw lastError || new Error('下载失败');
  }

  async retryTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    if (task.status === 'downloading') {
      throw new Error('任务正在下载中');
    }

    // 重置任务状态
    task.status = 'pending';
    task.progress = 0;
    task.downloadedSize = 0;
    task.error = undefined;
    await this.saveMetadata();

    // 重新开始下载
    this.startDownload(taskId);
  }

  getTasks(): OfflineDownloadTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): OfflineDownloadTask | undefined {
    return this.tasks.get(taskId);
  }

  async deleteTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // 取消正在进行的下载
    const controller = this.activeDownloads.get(taskId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(taskId);
    }

    // 删除文件
    if (task.filePath) {
      try {
        const isM3u8 = task.filePath.endsWith('.m3u8');

        if (isM3u8) {
          // 删除整个目录
          const videoDir = path.dirname(task.filePath);
          const files = await readdir(videoDir);
          for (const file of files) {
            await unlink(path.join(videoDir, file));
          }
          fs.rmdirSync(videoDir);
        } else {
          // 删除单个文件
          await unlink(task.filePath);
        }
      } catch (error) {
        console.error('删除文件失败:', error);
      }
    }

    this.tasks.delete(taskId);
    await this.saveMetadata();
  }

  async getOfflineVideo(source: string, videoId: string, episodeIndex: number): Promise<string | null> {
    const fileName = this.generateFileName(source, videoId, episodeIndex);
    const filePath = path.join(this.downloadDir, fileName);

    if (fs.existsSync(filePath)) {
      return filePath;
    }

    return null;
  }
}

export const offlineDownloadManager = new OfflineDownloadManager();
