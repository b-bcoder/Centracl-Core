const { app, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');

let activeConversion;
const stagedDirectory = path.join(app.getPath('temp'), 'central-core-fcp-staging');
const wallpaperConfigPath = path.join(app.getPath('userData'), 'wallpaper.json');

function whisperRuntimeDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'whisper-runtime')
    : path.join(__dirname, 'general', 'Tools', 'File explorer', 'FCP (File Converter Pro)', 'whisper-runtime');
}

function bufferFromData(data) {
  if (typeof data === 'string') return null;
  return Buffer.from(data);
}

async function withInputFile(data, fileName, callback) {
  if (typeof data === 'string') return callback(data, false);

  const directory = path.join(os.tmpdir(), 'central-core-fcp', crypto.randomUUID());
  await fs.mkdir(directory, { recursive: true });
  const inputPath = path.join(directory, path.basename(fileName || 'input.bin'));
  await fs.writeFile(inputPath, bufferFromData(data));

  try {
    return await callback(inputPath, true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function convertImage(inputPath, targetFormat) {
  const image = sharp(inputPath).rotate();
  switch (String(targetFormat).toUpperCase()) {
    case 'JPG':
    case 'JPEG':
      return image.jpeg({ quality: 90 }).toBuffer();
    case 'PNG':
      return image.png().toBuffer();
    case 'WEBP':
      return image.webp({ quality: 90 }).toBuffer();
    case 'AVIF':
      return image.avif({ quality: 80 }).toBuffer();
    case 'HEIC':
      throw new Error('HEIC-uitvoer is niet beschikbaar: deze build bevat geen HEVC/HEIC-encoder. AVIF-uitvoer werkt wel.');
    default:
      return null;
  }
}

function runFfmpeg(event, args, durationSeconds, fileName) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, args, { windowsHide: true });
    activeConversion = process;
    let stderr = '';
    let stdoutBuffer = '';
    let timeSeconds = 0;

    process.stdout.on('data', chunk => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const match = line.match(/^out_time_(?:ms|us)=(\d+)/);
        if (match && durationSeconds > 0) {
          const value = Number(match[1]);
          timeSeconds = value / (line.startsWith('out_time_ms') ? 1_000_000 : 1_000_000);
          const progress = Math.min(99, Math.max(0, Math.round((timeSeconds / durationSeconds) * 100)));
          event.sender.send('fcp:media-progress', { fileName, progress, etaSeconds: null });
        }
      }
    });
    process.stderr.on('data', chunk => {
      stderr += chunk.toString();
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (match && durationSeconds === 0) {
        durationSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
      }
    });
    process.once('error', error => reject(error));
    process.once('close', code => {
      if (activeConversion === process) activeConversion = undefined;
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}.`));
    });
  });
}

async function convertMedia(event, fileData, fileName, targetFormat) {
  return withInputFile(fileData, fileName, async inputPath => {
    const imageResult = await convertImage(inputPath, targetFormat);
    if (imageResult) {
      event.sender.send('fcp:media-progress', { fileName, progress: 100, etaSeconds: 0 });
      return imageResult;
    }

    const extension = String(targetFormat).toLowerCase();
    const directory = path.join(os.tmpdir(), 'central-core-fcp', crypto.randomUUID());
    await fs.mkdir(directory, { recursive: true });
    const outputPath = path.join(directory, `output.${extension}`);

    try {
      await runFfmpeg(event, [
        '-hide_banner', '-y', '-i', inputPath,
        '-progress', 'pipe:1', '-nostats', outputPath
      ], 0, fileName);
      event.sender.send('fcp:media-progress', { fileName, progress: 100, etaSeconds: 0 });
      return await fs.readFile(outputPath);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
}

function imageDataUrl(filePath, data) {
  const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.bmp': 'image/bmp' };
  const mime = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  return `data:${mime};base64,${data.toString('base64')}`;
}

async function readWallpaper() {
  try {
    const config = JSON.parse(await fs.readFile(wallpaperConfigPath, 'utf8'));
    const data = await fs.readFile(config.path);
    return { enabled: true, path: config.path, dataUrl: imageDataUrl(config.path, data) };
  } catch {
    return { enabled: false, path: null, dataUrl: null };
  }
}

function runWhisper(event, executablePath, args, options) {
  return new Promise((resolve, reject) => {
    const process = spawn(executablePath, args, { ...options, windowsHide: true });
    let stdout = '';
    let stderr = '';
    process.stdout.on('data', chunk => { stdout += chunk.toString(); });
    process.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderr += text;
      for (const match of text.matchAll(/progress\s*=\s*(\d+)%/gi)) {
        event.sender.send('fcp:transcription-progress', Number(match[1]));
      }
    });
    process.once('error', reject);
    process.once('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr.trim() || `Whisper exited with code ${code}.`)));
  });
}

function registerFcpIpc() {
  ipcMain.handle('fcp:get-ffmpeg-path', () => ffmpegPath);
  ipcMain.handle('fcp:get-gpu-info', () => ({ hasDedicatedGpu: false, vendor: 'unknown', name: os.cpus()[0]?.model || 'CPU', encoder: null }));
  ipcMain.handle('fcp:cancel-conversion', () => {
    if (activeConversion && !activeConversion.killed) activeConversion.kill();
    return true;
  });
  ipcMain.handle('fcp:convert-media', (event, data, fileName, targetFormat) => convertMedia(event, data, fileName, targetFormat));
  ipcMain.handle('fcp:choose-output-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0] || null;
  });
  ipcMain.handle('fcp:save-file', async (_event, options = {}) => {
    const fileName = path.basename(String(options.fileName || 'download'));
    let outputPath;
    if (options.outputDirectory) {
      outputPath = path.join(options.outputDirectory, fileName);
    } else {
      const result = await dialog.showSaveDialog({ defaultPath: fileName });
      if (result.canceled || !result.filePath) return null;
      outputPath = result.filePath;
    }
    if (options.data !== undefined) {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, Buffer.from(options.data));
    }
    return outputPath;
  });
  ipcMain.handle('fcp:get-wallpaper', readWallpaper);
  ipcMain.handle('fcp:choose-wallpaper', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Afbeeldingen', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
    });
    if (result.canceled || !result.filePaths[0]) return readWallpaper();
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    const selectedPath = result.filePaths[0];
    const storedPath = path.join(app.getPath('userData'), `wallpaper${path.extname(selectedPath).toLowerCase()}`);
    await fs.copyFile(selectedPath, storedPath);
    await fs.writeFile(wallpaperConfigPath, JSON.stringify({ path: storedPath }), 'utf8');
    return readWallpaper();
  });
  ipcMain.handle('fcp:disable-wallpaper', async () => {
    await fs.rm(wallpaperConfigPath, { force: true });
    return { enabled: false, path: null, dataUrl: null };
  });
  ipcMain.handle('fcp:stage-file', async (_event, fileData, fileName) => {
    await fs.mkdir(stagedDirectory, { recursive: true });
    const stagedPath = path.join(stagedDirectory, `${crypto.randomUUID()}-${path.basename(fileName || 'file')}`);
    if (typeof fileData === 'string') await fs.copyFile(fileData, stagedPath);
    else await fs.writeFile(stagedPath, Buffer.from(fileData));
    return stagedPath;
  });
  ipcMain.handle('fcp:read-file', async (_event, filePath) => {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(stagedDirectory) + path.sep)) throw new Error('Only staged files can be read.');
    const data = await fs.readFile(resolvedPath);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  });
  ipcMain.handle('fcp:cleanup-staged-file', async (_event, filePath) => {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(stagedDirectory) + path.sep)) return false;
    await fs.rm(resolvedPath, { force: true });
    return true;
  });
  ipcMain.handle('fcp:delete-source-file', async (_event, filePath) => {
    await fs.rm(path.resolve(filePath), { force: true });
    return true;
  });
  ipcMain.handle('fcp:get-vault-status', () => ({ enabled: false }));
  ipcMain.handle('fcp:transcribe-audio', async (event, data, fileName, targetFormat) => {
    const runtimeDirectory = whisperRuntimeDirectory();
    const executablePath = path.join(runtimeDirectory, 'whisper-cli.exe');
    const modelPath = path.join(runtimeDirectory, 'ggml-base.en.bin');
    await Promise.all([fs.access(executablePath), fs.access(modelPath)]).catch(() => {
      throw new Error('Whisper runtime or model is missing from this installation. Rebuild the installer with the whisper-runtime assets.');
    });

    return withInputFile(data, fileName, async inputPath => {
      const outputDirectory = path.join(os.tmpdir(), 'central-core-fcp', crypto.randomUUID());
      await fs.mkdir(outputDirectory, { recursive: true });
      const outputBase = path.join(outputDirectory, 'transcript');
      const normalizedAudioPath = path.join(outputDirectory, 'audio.wav');
      const formatFlag = String(targetFormat).toUpperCase() === 'SRT' ? '-osrt' : '-otxt';
      try {
        await runFfmpeg(event, [
          '-hide_banner', '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000',
          '-c:a', 'pcm_s16le', '-progress', 'pipe:1', '-nostats', normalizedAudioPath
        ], 0, fileName);
        await runWhisper(event, executablePath, ['-m', modelPath, '-f', normalizedAudioPath, '-l', 'en', '-pp', formatFlag, '-of', outputBase], { cwd: runtimeDirectory });
        const outputPath = `${outputBase}.${String(targetFormat).toLowerCase() === 'srt' ? 'srt' : 'txt'}`;
        event.sender.send('fcp:transcription-progress', 100);
        return await fs.readFile(outputPath, 'utf8');
      } finally {
        await fs.rm(outputDirectory, { recursive: true, force: true });
      }
    });
  });
}

function stopFcpIpc() {
  if (activeConversion && !activeConversion.killed) activeConversion.kill();
}

module.exports = { registerFcpIpc, stopFcpIpc };
