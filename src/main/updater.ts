import axios from "axios";
import { app, dialog, shell } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// GitHub仓库信息
const REPO_OWNER = "Baka-Course-Platform";
const REPO_NAME = "Baka-Course-Platform";
const GITHUB_API_BASE = "https://api.github.com";

// 当前应用版本
const CURRENT_VERSION = app.getVersion();

// 更新检查间隔（24小时）
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000;

// 更新状态
export interface UpdateInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  publishedAt: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  updateInfo?: UpdateInfo;
  error?: string;
}

// 获取平台特定的文件扩展名
function getPlatformFileExtension(): string {
  const platform = os.platform();
  switch (platform) {
    case "win32":
      return ".exe";
    case "darwin":
      return ".dmg";
    case "linux":
      return ".AppImage";
    default:
      return "";
  }
}

// 获取平台特定的架构
function getPlatformArch(): string {
  const arch = os.arch();
  const platform = os.platform();
  
  if (platform === "darwin") {
    return arch === "arm64" ? "arm64" : "x64";
  } else if (platform === "win32") {
    return arch === "x64" ? "x64" : "ia32";
  } else {
    return "x64";
  }
}

// 比较版本号
function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split(".").map(Number);
  const v2Parts = version2.split(".").map(Number);
  
  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

// 检查是否有新版本
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    console.log("🔍 开始检查更新...");
    console.log(`📡 请求URL: ${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
    console.log(`📱 当前版本: ${CURRENT_VERSION}`);
    
    // 获取最新发布版本
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      {
        timeout: 10000,
        headers: {
          "User-Agent": "Smart-Course-Platform-Updater",
          "Accept": "application/vnd.github.v3+json",
        },
      }
    );

    const release = response.data;
    const latestVersion = release.tag_name.replace(/^v/, ""); // 移除v前缀
    
    console.log(`📊 版本比较: 当前=${CURRENT_VERSION}, 最新=${latestVersion}`);
    
    // 比较版本
    const versionComparison = compareVersions(latestVersion, CURRENT_VERSION);
    console.log(`🔍 版本比较结果: ${versionComparison} (正数表示有更新)`);
    
    if (versionComparison <= 0) {
      console.log("✅ 当前已是最新版本");
      return { 
        hasUpdate: false, 
        currentVersion: CURRENT_VERSION,
        latestVersion: latestVersion
      };
    }
    
    console.log("🆕 发现新版本！");

    // 查找适合当前平台的下载文件
    const platform = os.platform();
    const arch = getPlatformArch();
    const extension = getPlatformFileExtension();
    
    let asset = null;
    
    // 根据平台和架构查找对应的资源文件
    if (platform === "darwin") {
      // macOS: 查找.dmg文件
      asset = release.assets.find((a: any) => 
        a.name.includes(".dmg") && 
        (arch === "arm64" ? a.name.includes("arm64") : a.name.includes("x64"))
      );
    } else if (platform === "win32") {
      // Windows: 查找.exe文件
      asset = release.assets.find((a: any) => 
        a.name.includes(".exe") && 
        (arch === "x64" ? a.name.includes("x64") : a.name.includes("ia32"))
      );
    } else if (platform === "linux") {
      // Linux: 查找.AppImage文件
      asset = release.assets.find((a: any) => 
        a.name.includes(".AppImage")
      );
    }

    if (!asset) {
      return {
        hasUpdate: true,
        currentVersion: CURRENT_VERSION,
        latestVersion: latestVersion,
        error: "未找到适合当前平台的更新文件",
      };
    }

    const updateInfo: UpdateInfo = {
      version: latestVersion,
      releaseNotes: release.body || "无更新说明",
      downloadUrl: asset.browser_download_url,
      fileName: asset.name,
      fileSize: asset.size,
      publishedAt: release.published_at,
    };

    return {
      hasUpdate: true,
      currentVersion: CURRENT_VERSION,
      latestVersion: latestVersion,
      updateInfo,
    };
  } catch (error) {
    console.error("检查更新失败:", error);
    return {
      hasUpdate: false,
      currentVersion: CURRENT_VERSION,
      error: error instanceof Error ? error.message : "检查更新时发生未知错误",
    };
  }
}

// 下载更新文件
export async function downloadUpdate(
  updateInfo: UpdateInfo,
  onProgress?: (progress: { percent: number; downloaded: number; total: number }) => void
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    console.log(`🚀 开始下载更新: ${updateInfo.fileName}`);
    console.log(`📡 下载URL: ${updateInfo.downloadUrl}`);
    console.log(`📦 文件大小: ${(updateInfo.fileSize / 1024 / 1024).toFixed(1)} MB`);
    
    // 创建下载目录
    const downloadDir = path.join(os.tmpdir(), "smart-course-platform-updates");
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    const filePath = path.join(downloadDir, updateInfo.fileName);
    
    // 发送下载开始事件
    const { BrowserWindow } = await import("electron");
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window) => {
      window.webContents.send("download-started", {
        fileName: updateInfo.fileName,
        fileSize: updateInfo.fileSize
      });
    });
    
    // 下载文件
    console.log(`📡 开始下载: ${updateInfo.downloadUrl}`);
    
    const response = await axios.get(updateInfo.downloadUrl, {
      responseType: "stream",
      timeout: 30000, // 30秒连接超时
      headers: {
        "User-Agent": "Smart-Course-Platform-Updater/1.0",
        "Accept": "*/*",
      },
    });

    const writer = fs.createWriteStream(filePath);
    const totalSize = updateInfo.fileSize;
    let downloadedSize = 0;
    let lastProgressTime = Date.now();
    let timeoutId: NodeJS.Timeout | null = null;

    // 设置下载超时（5分钟）
    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.error("⏰ 下载超时 - 5分钟内没有进度更新");
        writer.destroy();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 300000); // 5分钟超时
    };

    // 监听下载进度
    response.data.on('data', (chunk: Buffer) => {
      downloadedSize += chunk.length;
      const percent = Math.round((downloadedSize / totalSize) * 100);
      const now = Date.now();
      
      // 每5%或每10秒输出一次进度
      if (percent % 5 === 0 || now - lastProgressTime > 10000) {
        console.log(`📥 下载进度: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
        lastProgressTime = now;
      }
      
      // 发送进度更新事件
      allWindows.forEach((window) => {
        window.webContents.send("download-progress", {
          percent,
          downloaded: downloadedSize,
          total: totalSize,
          downloadedMB: (downloadedSize / 1024 / 1024).toFixed(1),
          totalMB: (totalSize / 1024 / 1024).toFixed(1)
        });
      });
      
      if (onProgress) {
        onProgress({ percent, downloaded: downloadedSize, total: totalSize });
      }
      
      // 重置超时计时器
      resetTimeout();
    });

    response.data.pipe(writer);

    return new Promise((resolve) => {
      // 初始超时设置
      resetTimeout();
      
      writer.on("finish", () => {
        if (timeoutId) clearTimeout(timeoutId);
        console.log(`✅ 更新文件下载完成: ${filePath}`);
        
        // 验证文件大小
        const stats = fs.statSync(filePath);
        if (stats.size !== totalSize) {
          console.warn(`⚠️ 文件大小不匹配: 期望 ${totalSize}, 实际 ${stats.size}`);
          fs.unlinkSync(filePath);
          resolve({
            success: false,
            error: "文件大小不匹配，下载可能不完整",
          });
          return;
        }
        
        // 发送下载完成事件
        allWindows.forEach((window) => {
          window.webContents.send("download-completed", {
            filePath,
            fileName: updateInfo.fileName
          });
        });
        
        resolve({ success: true, filePath });
      });

      writer.on("error", (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error("❌ 写入文件失败:", error);
        
        // 清理文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // 发送下载失败事件
        allWindows.forEach((window) => {
          window.webContents.send("download-error", {
            error: error.message
          });
        });
        
        resolve({
          success: false,
          error: `写入文件失败: ${error.message}`,
        });
      });
      
      // 监听响应错误
      response.data.on('error', (error: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error("❌ 下载流错误:", error);
        
        // 清理文件
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        
        // 发送下载失败事件
        allWindows.forEach((window) => {
          window.webContents.send("download-error", {
            error: error.message
          });
        });
        
        resolve({
          success: false,
          error: `下载流错误: ${error.message}`,
        });
      });
    });
  } catch (error) {
    console.error("❌ 下载更新失败:", error);
    
    // 发送下载错误事件
    const { BrowserWindow } = await import("electron");
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window) => {
      window.webContents.send("download-error", {
        error: error instanceof Error ? error.message : "下载更新时发生未知错误"
      });
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "下载更新时发生未知错误",
    };
  }
}

// 安装更新
export async function installUpdate(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const platform = os.platform();
    
    if (platform === "darwin") {
      // macOS: 打开.dmg文件
      await shell.openPath(filePath);
      return { success: true };
    } else if (platform === "win32") {
      // Windows: 运行.exe安装程序
      const { spawn } = await import("child_process");
      const installer = spawn(filePath, ["/S"], { detached: true, stdio: "ignore" });
      installer.unref();
      return { success: true };
    } else if (platform === "linux") {
      // Linux: 给AppImage添加执行权限并运行
      fs.chmodSync(filePath, "755");
      const { spawn } = await import("child_process");
      const installer = spawn(filePath, [], { detached: true, stdio: "ignore" });
      installer.unref();
      return { success: true };
    }
    
    return {
      success: false,
      error: "不支持的操作系统",
    };
  } catch (error) {
    console.error("安装更新失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "安装更新时发生未知错误",
    };
  }
}

// 显示更新对话框
export async function showUpdateDialog(updateInfo: UpdateInfo): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: "info",
    title: "发现新版本",
    message: `发现新版本 ${updateInfo.version}`,
    detail: `当前版本: ${CURRENT_VERSION}\n\n更新说明:\n${updateInfo.releaseNotes}\n\n文件大小: ${(updateInfo.fileSize / 1024 / 1024).toFixed(1)} MB\n发布时间: ${new Date(updateInfo.publishedAt).toLocaleString("zh-CN")}`,
    buttons: ["立即更新", "稍后提醒", "跳过此版本"],
    defaultId: 0,
    cancelId: 1,
  });

  return result.response === 0; // 0 = 立即更新
}

// 自动检查更新（在应用启动时调用）
export async function autoCheckForUpdates(): Promise<void> {
  try {
    // 检查上次检查时间
    const lastCheckTime = getLastUpdateCheckTime();
    const now = Date.now();
    
    // 如果距离上次检查不足24小时，跳过检查
    if (lastCheckTime && (now - lastCheckTime) < UPDATE_CHECK_INTERVAL) {
      console.log("跳过自动更新检查（距离上次检查不足24小时）");
      return;
    }
    
    console.log("开始自动检查更新...");
    const result = await checkForUpdates();
    
    if (result.hasUpdate && result.updateInfo) {
      console.log(`发现新版本: ${result.updateInfo.version}`);
      // 发送事件到渲染进程显示更新通知
      const { BrowserWindow } = await import("electron");
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        window.webContents.send("update-available", {
          updateInfo: result.updateInfo,
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion
        });
      });
    } else if (result.error) {
      console.error("自动更新检查失败:", result.error);
      // 发送错误信息到渲染进程
      const { BrowserWindow } = await import("electron");
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        window.webContents.send("update-check-error", {
          error: result.error,
          currentVersion: result.currentVersion
        });
      });
    } else {
      console.log(`当前已是最新版本 (${result.currentVersion})`);
      // 发送已是最新版本的信息到渲染进程
      const { BrowserWindow } = await import("electron");
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window) => {
        window.webContents.send("update-check-complete", {
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          isLatest: true
        });
      });
    }
    
    // 更新最后检查时间
    setLastUpdateCheckTime(now);
  } catch (error) {
    console.error("自动更新检查异常:", error);
  }
}

// 获取上次更新检查时间
function getLastUpdateCheckTime(): number | null {
  try {
    const dataPath = path.join(app.getPath("userData"), "update-check.json");
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      return data.lastCheckTime || null;
    }
  } catch (error) {
    console.error("读取更新检查时间失败:", error);
  }
  return null;
}

// 设置最后更新检查时间
function setLastUpdateCheckTime(timestamp: number): void {
  try {
    const dataPath = path.join(app.getPath("userData"), "update-check.json");
    const data = { lastCheckTime: timestamp };
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("保存更新检查时间失败:", error);
  }
}