const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('node:fs/promises');
const { createReadStream, createWriteStream } = require('node:fs');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const crypto = require('node:crypto');
const { randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const ffmpegPath = require('ffmpeg-static');
const { hashRaw } = require('@node-rs/argon2');
const sevenZipPath = app.isPackaged
  ? require('7zip-bin').path7za.replace('app.asar', 'app.asar.unpacked')
  : require('7zip-bin').path7za;

const isDevelopment = !app.isPackaged;
const developmentUrl = 'http://localhost:3000';
const updateRepository = 'b-bcoder/FCP-File-Converter-Pro-Up-to-Date';
const iconPath = path.join(__dirname, 'assets', 'icon.ico');
const whisperRuntimePath = app.isPackaged
  ? path.join(process.resourcesPath, 'whisper-runtime')
  : path.join(__dirname, 'whisper-runtime');
const whisperRootPath = path.join(__dirname, 'node_modules', 'whisper-node', 'lib', 'whisper.cpp').replace('app.asar', 'app.asar.unpacked');
const whisperExecutablePath = process.platform === 'win32'
  ? path.join(whisperRuntimePath, 'whisper-cli.exe')
  : path.join(whisperRootPath, 'main');
const whisperModelPath = process.platform === 'win32'
  ? path.join(whisperRuntimePath, 'ggml-base.en.bin')
  : path.join(whisperRootPath, 'models', 'ggml-base.en.bin');
const gpuInfo = detectGpu();
const nativeFfmpegPath = app.isPackaged
  ? ffmpegPath.replace('app.asar', 'app.asar.unpacked')
  : ffmpegPath;

function summarizeFfmpegError(output) {
  const text = String(output || '').replace(/\r/g, '').trim();

  if (!text) {
    return 'Conversion failed. The file could not be converted.';
  }

  const lower = text.toLowerCase();

  if (/no sequence header|bitstream not supported by this decoder|corrupt frame detected|failed to decode frame|error while decoding/i.test(lower)) {
    return 'Conversion failed: the source file appears to be corrupted or uses an unsupported codec/encoding.';
  }

  if (/invalid data found when processing input|moov atom|is not a supported file|could not find codec parameters|unable to decode/i.test(lower)) {
    return 'Conversion failed: the source file is damaged or in an unsupported format.';
  }

  if (/stalled for over 60 seconds|timed out|sigkill/i.test(lower)) {
    return 'Conversion failed: the conversion stalled and could not finish.';
  }

  if (/no such file or directory|could not open|not found/i.test(lower)) {
    return 'Conversion failed: the source file could not be found or opened.';
  }

  if (/unsupported codec|unknown codec|codec not currently supported/i.test(lower)) {
    return 'Conversion failed: the selected output format is not supported for this source file.';
  }

  const usefulLines = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^ffmpeg version/i.test(line))
    .filter(line => !/^libav/i.test(line))
    .filter(line => !/^configuration:/i.test(line))
    .filter(line => !/^built with/i.test(line))
    .filter(line => !/^input #/i.test(line))
    .filter(line => !/^output #/i.test(line))
    .filter(line => !/^stream mapping:/i.test(line))
    .filter(line => !/^\[.*\]$/.test(line));

  const meaningfulLine = usefulLines.find(line => !/copyright|all rights reserved|freely distributed/i.test(line));

  if (meaningfulLine) {
    const cleanMessage = meaningfulLine.replace(/^error:/i, '').trim();
    return cleanMessage.length > 120 ? 'Conversion failed. The file could not be converted with the current settings.' : `Conversion failed: ${cleanMessage}.`;
  }

  return 'Conversion failed. The file could not be converted with the current settings.';
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.fcp.fileconverter');
}

if (!gpuInfo.hasDedicatedGpu) {
  app.disableHardwareAcceleration();
}

Menu.setApplicationMenu(null);

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 560,
    height: 300,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#0b1220',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const version = app.getVersion();
  const splashHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; }
      html, body { height: 100%; margin: 0; }
      body {
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #0b1220;
        color: #f8fafc;
        font-family: "Segoe UI", sans-serif;
        animation: splash-in 3500ms ease-out both;
      }
      main { text-align: center; }
      .mark {
        width: 64px;
        height: 64px;
        margin: 0 auto 22px;
        border: 2px solid #22d3ee;
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: #22d3ee;
        font-size: 21px;
        font-weight: 700;
        letter-spacing: 1px;
        box-shadow: 0 0 30px rgba(34, 211, 238, 0.2);
      }
      h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.2px; }
      p { margin: 12px 0 0; color: #94a3b8; font-size: 14px; }
      .fade-out { animation: splash-out 3500ms ease-in forwards; }
      @keyframes splash-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
      @keyframes splash-out { from { opacity: 1; } to { opacity: 0; } }
    </style>
  </head>
  <body>
    <main>
      <div class="mark">FCP</div>
      <h1>FCP - File Converter Pro</h1>
      <p>Author: B&amp;B Coder | v${version}</p>
    </main>
  </body>
</html>`;

  splash.show();
  splash.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(splashHtml)}`).catch(() => undefined);
  return splash;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    autoHideMenuBar: true,
    fullscreen: true,
    show: false,
    opacity: 0,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      window.setFullScreen(!window.isFullScreen());
    }
  });

  if (isDevelopment) {
    loadDevelopmentPage(window);
  } else {
    window.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  let hasRevealed = false;
  const revealWindow = () => {
    if (hasRevealed) return;
    hasRevealed = true;
    const splash = window.splashWindow;
    const showMainWindow = () => {
      if (window.isDestroyed()) return;
      window.setOpacity(0);
      window.show();
      window.focus();

      const fadeStart = Date.now();
      const fadeDuration = 1500;
      const fadeIn = () => {
        if (window.isDestroyed()) return;
        const progress = Math.min(1, (Date.now() - fadeStart) / fadeDuration);
        window.setOpacity(progress);
        if (progress < 1) setTimeout(fadeIn, 16);
      };
      fadeIn();
    };

    if (!splash || splash.isDestroyed()) {
      showMainWindow();
      return;
    }

    splash.webContents.executeJavaScript("document.body.classList.add('fade-out')").catch(() => undefined);
    setTimeout(() => {
      if (!splash.isDestroyed()) splash.close();
      showMainWindow();
    }, 2500);
  };

  window.webContents.once('did-finish-load', revealWindow);
  window.once('ready-to-show', revealWindow);
  setTimeout(revealWindow, 15000);

  return window;
}

const wallpaperConfigPath = path.join(app.getPath('userData'), 'config.json');
const vaultConfigPath = path.join(app.getPath('userData'), 'vault-config.json');
let activeConversionProcess = null;

const VAULT_MAGIC = 'FCPVAULT1';
const VAULT_VERSION = 1;
const VAULT_KDF_OPTIONS = { algorithm: 2, memoryCost: 65536, timeCost: 3, parallelism: 1, outputLen: 32 };

async function readVaultConfig() {
  try {
    return JSON.parse(await fs.readFile(vaultConfigPath, 'utf8'));
  } catch {
    return null;
  }
}

async function deriveVaultKey(password, salt) {
  if (typeof password !== 'string' || password.length < 10) throw new Error('Vault password must contain at least 10 characters.');
  return hashRaw(password, { ...VAULT_KDF_OPTIONS, salt: Buffer.from(salt, 'base64') });
}

function encryptVaultPayload(data, key) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(data)), cipher.final()]);
  return { magic: VAULT_MAGIC, version: VAULT_VERSION, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
}

function decryptVaultPayload(container, key) {
  if (container?.magic !== VAULT_MAGIC || container.version !== VAULT_VERSION) throw new Error('Unsupported vault container.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(container.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(container.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(container.data, 'base64')), decipher.final()]);
}

async function saveVaultFileFromZipPath(config, key, sourcePath, fileName) {
  const zipPath = resolveTempZipPath(sourcePath);
  const zipStats = await fs.stat(zipPath);
  const vaultDirectory = path.join(config.outputDirectory, '.fcp-vault');
  await fs.mkdir(vaultDirectory, { recursive: true });
  const entries = (await fs.readdir(vaultDirectory)).filter(name => name.endsWith('.fcpv'));
  const currentSize = (await Promise.all(entries.map(async name => (await fs.stat(path.join(vaultDirectory, name))).size))).reduce((sum, size) => sum + size, 0);
  const token = randomUUID();
  const encryptedPayloadPath = path.join(vaultDirectory, `${token}.payload.tmp`);
  const containerTempPath = path.join(vaultDirectory, `${token}.container.tmp`);
  const storagePath = path.join(vaultDirectory, `${token}.fcpv`);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

  const payload = Readable.from((async function* () {
    yield Buffer.from(`{"fileName":${JSON.stringify(fileName)},"data":"`);
    let pending = Buffer.alloc(0);
    for await (const chunk of createReadStream(zipPath)) {
      const combined = pending.length ? Buffer.concat([pending, chunk]) : chunk;
      const completeLength = combined.length - combined.length % 3;
      if (completeLength) yield Buffer.from(combined.subarray(0, completeLength).toString('base64'));
      pending = combined.subarray(completeLength);
    }
    if (pending.length) yield Buffer.from(pending.toString('base64'));
    yield Buffer.from('"}');
  })());

  const createBase64Transform = () => {
    let pending = Buffer.alloc(0);
    return new Transform({
      transform(chunk, _encoding, callback) {
        const combined = pending.length ? Buffer.concat([pending, chunk]) : chunk;
        const completeLength = combined.length - combined.length % 3;
        if (completeLength) this.push(combined.subarray(0, completeLength).toString('base64'));
        pending = combined.subarray(completeLength);
        callback();
      },
      flush(callback) {
        if (pending.length) this.push(pending.toString('base64'));
        callback();
      },
    });
  };

  try {
    await pipeline(payload, cipher, createWriteStream(encryptedPayloadPath, { flags: 'wx' }));
    const containerPrefix = JSON.stringify({
      magic: VAULT_MAGIC,
      version: VAULT_VERSION,
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: '',
    }).slice(0, -2);
    await fs.writeFile(containerTempPath, containerPrefix, { flag: 'wx' });
    await pipeline(createReadStream(encryptedPayloadPath), createBase64Transform(), createWriteStream(containerTempPath, { flags: 'a' }));
    await fs.appendFile(containerTempPath, '"}');

    const containerStats = await fs.stat(containerTempPath);
    if (currentSize + containerStats.size > config.quotaBytes) throw new Error('The vault quota has been reached.');
    await fs.rename(containerTempPath, storagePath);
    return { storagePath, bytes: zipStats.size };
  } finally {
    await Promise.all([
      fs.rm(encryptedPayloadPath, { force: true }),
      fs.rm(containerTempPath, { force: true }),
    ]);
  }
}

ipcMain.handle('fcp:get-vault-status', async () => {
  const config = await readVaultConfig();
  return config ? { enabled: true, outputDirectory: config.outputDirectory, quotaBytes: config.quotaBytes } : { enabled: false };
});

ipcMain.handle('fcp:create-vault', async (_event, options) => {
  const requestedDirectory = String(options?.outputDirectory || '').trim();
  if (!requestedDirectory) throw new Error('Choose an output directory before creating a vault.');
  const outputDirectory = path.resolve(requestedDirectory);
  const password = String(options?.password || '');
  const quotaGb = Number(options?.quotaGb);
  if (!outputDirectory || !Number.isFinite(quotaGb) || quotaGb <= 0 || quotaGb > 1024) throw new Error('Invalid vault settings.');
  const salt = crypto.randomBytes(16).toString('base64');
  const key = await deriveVaultKey(password, salt);
  const verifier = encryptVaultPayload(Buffer.from('FCP vault verifier'), key);
  await fs.mkdir(path.join(outputDirectory, '.fcp-vault'), { recursive: true });
  const quotaBytes = Math.floor(quotaGb * 1024 ** 3);
  await fs.writeFile(vaultConfigPath, JSON.stringify({ version: VAULT_VERSION, outputDirectory, quotaBytes, salt, verifier }), 'utf8');
  return { enabled: true, outputDirectory, quotaBytes };
});

ipcMain.handle('fcp:disable-vault', async () => {
  await fs.rm(vaultConfigPath, { force: true });
  return true;
});

ipcMain.handle('fcp:save-vault-file', async (_event, options) => {
  const config = await readVaultConfig();
  if (!config) throw new Error('No vault is configured.');
  const key = await deriveVaultKey(String(options?.password || ''), config.salt);
  decryptVaultPayload(config.verifier, key);
  const fileName = path.basename(String(options?.fileName || 'converted-files.zip'));
  if (options?.filePath) return saveVaultFileFromZipPath(config, key, options.filePath, fileName);
  const data = Buffer.from(options?.data || []);
  const vaultDirectory = path.join(config.outputDirectory, '.fcp-vault');
  await fs.mkdir(vaultDirectory, { recursive: true });
  const entries = (await fs.readdir(vaultDirectory)).filter(fileName => fileName.endsWith('.fcpv'));
  const currentSize = (await Promise.all(entries.map(async fileName => (await fs.stat(path.join(vaultDirectory, fileName))).size))).reduce((sum, size) => sum + size, 0);
  const payload = Buffer.from(JSON.stringify({ fileName, data: data.toString('base64') }), 'utf8');
  const containerData = Buffer.from(JSON.stringify(encryptVaultPayload(payload, key)), 'utf8');
  if (currentSize + containerData.length > config.quotaBytes) throw new Error('The vault quota has been reached.');
  const storagePath = path.join(vaultDirectory, `${randomUUID()}.fcpv`);
  await fs.writeFile(storagePath, containerData, { flag: 'wx' });
  return { storagePath, bytes: data.length };
});

ipcMain.handle('fcp:list-vault-files', async (_event, options) => {
  const config = await readVaultConfig();
  if (!config) throw new Error('No vault is configured.');
  const key = await deriveVaultKey(String(options?.password || ''), config.salt);
  decryptVaultPayload(config.verifier, key);
  const vaultDirectory = path.join(config.outputDirectory, '.fcp-vault');
  await fs.mkdir(vaultDirectory, { recursive: true });
  const fileNames = (await fs.readdir(vaultDirectory)).filter(fileName => fileName.endsWith('.fcpv'));
  const files = await Promise.all(fileNames.map(async storageName => {
    const stats = await fs.stat(path.join(vaultDirectory, storageName));
    let fileName = storageName;
    try {
      const container = JSON.parse(await fs.readFile(path.join(vaultDirectory, storageName), 'utf8'));
      const payload = decryptVaultPayload(container, key);
      const metadata = JSON.parse(payload.toString('utf8'));
      if (metadata?.fileName) fileName = path.basename(metadata.fileName);
    } catch {
      // Keep legacy containers visible; they can still be opened by read-vault-file.
    }
    return { storageName, fileName, bytes: stats.size, modifiedAt: stats.mtimeMs };
  }));
  return files.sort((left, right) => right.modifiedAt - left.modifiedAt);
});

ipcMain.handle('fcp:read-vault-file', async (_event, options) => {
  const config = await readVaultConfig();
  if (!config) throw new Error('No vault is configured.');
  const key = await deriveVaultKey(String(options?.password || ''), config.salt);
  decryptVaultPayload(config.verifier, key);
  const storageName = path.basename(String(options?.storageName || ''));
  if (!storageName.endsWith('.fcpv')) throw new Error('Invalid vault file.');
  const storagePath = path.join(config.outputDirectory, '.fcp-vault', storageName);
  const container = JSON.parse(await fs.readFile(storagePath, 'utf8'));
  const payload = decryptVaultPayload(container, key);
  try {
    const metadata = JSON.parse(payload.toString('utf8'));
    if (metadata?.data && metadata.fileName) return { fileName: path.basename(metadata.fileName), data: Buffer.from(metadata.data, 'base64') };
  } catch {
    // Legacy format stores the raw zip bytes directly in the encrypted payload.
  }
  return { fileName: 'converted-files.zip', data: payload };
});

ipcMain.handle('fcp:delete-vault-file', async (_event, options) => {
  const config = await readVaultConfig();
  if (!config) throw new Error('No vault is configured.');
  const key = await deriveVaultKey(String(options?.password || ''), config.salt);
  decryptVaultPayload(config.verifier, key);
  const storageName = path.basename(String(options?.storageName || ''));
  if (!storageName.endsWith('.fcpv')) throw new Error('Invalid vault file.');
  await fs.rm(path.join(config.outputDirectory, '.fcp-vault', storageName), { force: true });
  return true;
});

async function readWallpaperConfig() {
  try {
    const config = JSON.parse(await fs.readFile(wallpaperConfigPath, 'utf8'));
    const wallpaper = config?.Configurations?.Wallpaper;
    if (wallpaper?.Wallpaper_on_off !== 'On' || !wallpaper.Wallpaperpath) return { enabled: false, path: null, dataUrl: null };
    const imageData = await fs.readFile(wallpaper.Wallpaperpath);
    const extension = path.extname(wallpaper.Wallpaperpath).toLowerCase();
    const mimeType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    return { enabled: true, path: wallpaper.Wallpaperpath, dataUrl: `data:${mimeType};base64,${imageData.toString('base64')}` };
  } catch {
    return { enabled: false, path: null, dataUrl: null };
  }
}

async function writeWallpaperConfig(enabled, wallpaperPath = '') {
  const config = { Configurations: { Wallpaper: {
    Wallpaperset: Boolean(wallpaperPath), Wallpaperpath: wallpaperPath,
    Wallpaper_on_off: enabled && wallpaperPath ? 'On' : 'Off'
  } } };
  await fs.mkdir(path.dirname(wallpaperConfigPath), { recursive: true });
  await fs.writeFile(wallpaperConfigPath, JSON.stringify(config, null, 2), 'utf8');
}

ipcMain.handle('fcp:get-ffmpeg-path', () => ffmpegPath);
ipcMain.handle('fcp:get-gpu-info', () => gpuInfo);
ipcMain.handle('fcp:check-for-update', async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${updateRepository}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'File-Converter-Pro' }
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    const latestVersion = String(release.tag_name || '').match(/\d+(?:\.\d+){2,}/)?.[0] || '';
    const currentVersion = app.getVersion().replace(/^v/i, '');
    const parseVersion = version => (version.match(/\d+(?:\.\d+){2,}/)?.[0] || '0.0.0').split('.').map(Number);
    const current = parseVersion(currentVersion);
    const latest = parseVersion(latestVersion);
    const firstDifference = latest.findIndex((value, index) => value !== (current[index] || 0));
    const isNewer = firstDifference >= 0 && latest[firstDifference] > (current[firstDifference] || 0);
    const installer = Array.isArray(release.assets) ? release.assets.find(asset => /\.exe$/i.test(asset.name) && asset.browser_download_url) : null;
    if (!isNewer || !installer) return null;
    return { version: latestVersion, releaseUrl: release.html_url, downloadUrl: installer.browser_download_url, fileName: installer.name };
  } catch (error) {
    console.warn('Update check failed:', error.message || error);
    return null;
  }
});
ipcMain.handle('fcp:download-and-install-update', async (_event, update) => {
  if (!update?.downloadUrl || !/^https:\/\/github\.com\//i.test(update.downloadUrl)) throw new Error('Invalid update source.');
  const response = await fetch(update.downloadUrl, { headers: { 'User-Agent': 'File-Converter-Pro' } });
  if (!response.ok) throw new Error(`Update download failed with status ${response.status}`);
  const installerPath = path.join(os.tmpdir(), update.fileName || 'File-Converter-Pro-update.exe');
  await fs.writeFile(installerPath, Buffer.from(await response.arrayBuffer()));
  if (process.platform !== 'win32') throw new Error('Automatic installation is currently supported on Windows only.');
  spawn(installerPath, [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  setTimeout(() => app.quit(), 250);
  return true;
});
ipcMain.handle('fcp:cancel-conversion', async () => {
  if (activeConversionProcess && !activeConversionProcess.killed) {
    activeConversionProcess.kill('SIGKILL');
  }
  return true;
});
ipcMain.handle('fcp:get-wallpaper', () => readWallpaperConfig());
ipcMain.handle('fcp:transcribe-audio', async (event, fileData, fileName, targetFormat) => {
  const format = String(targetFormat || 'TXT').toUpperCase();
  const workDir = path.join(app.getPath('temp'), 'fcp-whisper', randomUUID());
  const extension = path.extname(fileName) || '.wav';
  const inputPath = path.join(workDir, `input${extension}`);
  const normalizedPath = path.join(workDir, 'normalized.wav');

  await fs.mkdir(workDir, { recursive: true });
  await fs.writeFile(inputPath, Buffer.from(fileData));

  try {
    if (process.platform === 'win32') {
      const runtimeFiles = ['whisper-cli.exe', 'whisper.dll', 'ggml.dll', 'ggml-base.dll', 'ggml-cpu.dll', 'ggml-base.en.bin'];
      await Promise.all(runtimeFiles.map(fileName => fs.access(path.join(whisperRuntimePath, fileName))));
    }

    const ffmpegArgs = ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', normalizedPath];
    await new Promise((resolve, reject) => {
      const process = spawn(nativeFfmpegPath, ffmpegArgs, { windowsHide: true });
      activeConversionProcess = process;
      let stderr = '';
      process.stderr.on('data', data => { stderr += data.toString(); });
      process.on('error', reject);
      process.on('close', code => {
        activeConversionProcess = null;
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `FFmpeg exited with code ${code}`));
      });
    });

    const whisperArgs = [
      '-m', whisperModelPath,
      '-f', normalizedPath,
      '-l', 'auto',
      '-pp',
      format === 'SRT' ? '-osrt' : '-otxt'
    ];
    const result = await new Promise((resolve, reject) => {
      const childProcess = spawn(whisperExecutablePath, whisperArgs, {
        cwd: whisperRootPath,
        windowsHide: true,
        env: {
          ...process.env,
          PATH: process.platform === 'win32'
            ? `${whisperRuntimePath};${process.env.PATH || ''}`
            : process.env.PATH
        }
      });
      activeConversionProcess = childProcess;
      let stdout = '';
      let stderr = '';
      const reportProgress = data => {
        const text = data.toString();
        const match = text.match(/(?:progress\s*[=:]?\s*|\s)(\d{1,3})%/i);
        if (match) {
          event.sender.send('fcp:transcription-progress', Number(match[1]));
        }
        stderr += text;
      };
      childProcess.stdout.on('data', data => {
        const text = data.toString();
        stdout += text;
        const match = text.match(/(?:progress\s*[=:]?\s*|\s)(\d{1,3})%/i);
        if (match) event.sender.send('fcp:transcription-progress', Number(match[1]));
      });
      childProcess.stderr.on('data', reportProgress);
      childProcess.on('error', reject);
      childProcess.on('close', code => {
        activeConversionProcess = null;
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr.trim() || stdout.trim() || `Whisper exited with code ${code}`));
      });
    });

    const outputExtension = format === 'SRT' ? '.srt' : '.txt';
    const outputFile = (await fs.readdir(workDir)).find(name => name.toLowerCase().endsWith(outputExtension));

    if (outputFile) {
      return await fs.readFile(path.join(workDir, outputFile), 'utf8');
    }

    if (Array.isArray(result) && result.length > 0) {
      return result
        .map((item) => item.speech ?? '')
        .filter(Boolean)
        .join('\n');
    }

    throw new Error('Whisper finished without producing a transcript file.');
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
});
ipcMain.handle('fcp:choose-wallpaper', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] });
  if (result.canceled || !result.filePaths[0]) return readWallpaperConfig();
  await writeWallpaperConfig(true, result.filePaths[0]);
  return readWallpaperConfig();
});
ipcMain.handle('fcp:choose-output-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? null : result.filePaths[0] || null;
});
ipcMain.handle('fcp:get-temp-directory', async () => app.getPath('temp'));
function resolveTempZipPath(filePath) {
  const zipDirectory = path.resolve(app.getPath('temp'), 'fcp-zips');
  const resolvedPath = path.resolve(String(filePath || ''));
  if (path.dirname(resolvedPath) !== zipDirectory || path.extname(resolvedPath).toLowerCase() !== '.zip') {
    throw new Error('Invalid temporary ZIP path.');
  }
  return resolvedPath;
}
ipcMain.handle('fcp:create-zip-file', async () => {
  const zipDirectory = path.join(app.getPath('temp'), 'fcp-zips');
  const zipPath = path.join(zipDirectory, `${randomUUID()}.zip`);
  await fs.mkdir(zipDirectory, { recursive: true });
  await fs.writeFile(zipPath, Buffer.alloc(0), { flag: 'wx' });
  return zipPath;
});
ipcMain.handle('fcp:append-zip-file', async (_event, filePath, data) => {
  await fs.appendFile(resolveTempZipPath(filePath), Buffer.from(data));
  return true;
});
ipcMain.handle('fcp:cleanup-zip-file', async (_event, filePath) => {
  await fs.rm(resolveTempZipPath(filePath), { force: true });
  return true;
});
ipcMain.handle('fcp:write-output-file', async (_event, filePath, data) => {
  const resolvedPath = path.resolve(String(filePath));
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, Buffer.from(data));
  return resolvedPath;
});
ipcMain.handle('fcp:write-debug-report', async (_event, options) => {
  const requestedDirectory = String(options?.outputDirectory || '').trim();
  const reportDirectory = requestedDirectory ? path.resolve(requestedDirectory) : app.getPath('userData');
  const reportPath = path.join(reportDirectory, 'debug.txt');
  await fs.mkdir(reportDirectory, { recursive: true });
  await fs.writeFile(reportPath, String(options?.report || ''), 'utf8');
  return reportPath;
});
ipcMain.handle('fcp:stage-file', async (_event, fileData, fileName) => {
  const stagingDirectory = path.join(app.getPath('temp'), 'fcp-staging');
  const stagedPath = path.join(stagingDirectory, `${randomUUID()}-${path.basename(String(fileName || 'input.bin'))}`);
  await fs.mkdir(stagingDirectory, { recursive: true });
  if (typeof fileData === 'string') {
    await fs.copyFile(fileData, stagedPath);
  } else {
    await fs.writeFile(stagedPath, Buffer.from(fileData));
  }
  return stagedPath;
});
ipcMain.handle('fcp:cleanup-staged-file', async (_event, filePath) => {
  await fs.rm(String(filePath), { force: true });
  return true;
});
ipcMain.handle('fcp:extract-archive', async (_event, requestedPath, requestedOutputDirectory, requestedFileName) => {
  const stagingDirectory = path.resolve(app.getPath('temp'), 'fcp-staging');
  const sourcePath = path.resolve(String(requestedPath || ''));
  if (path.dirname(sourcePath) !== stagingDirectory) throw new Error('Invalid staged archive path.');

  let outputDirectory = String(requestedOutputDirectory || '').trim();
  if (!outputDirectory) {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) throw new Error('Archive extraction was cancelled.');
    outputDirectory = result.filePaths[0];
  }
  outputDirectory = path.resolve(outputDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });

  const runSevenZip = (args) => new Promise((resolve, reject) => {
    const process = spawn(sevenZipPath, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let stdoutExceededLimit = false;
    process.stdout.on('data', chunk => {
      if (stdout.length + chunk.length > 4 * 1024 * 1024) stdoutExceededLimit = true;
      else stdout += chunk.toString();
    });
    process.stderr.on('data', chunk => { if (stderr.length < 1024 * 1024) stderr += chunk.toString(); });
    process.on('error', reject);
    process.on('close', code => {
      if (code !== 0) return reject(new Error(`7-Zip failed with code ${code}: ${(stderr || stdout).trim().slice(-800)}`));
      if (stdoutExceededLimit) return reject(new Error('Archive listing exceeds the 4 MB safety limit.'));
      resolve(stdout);
    });
  });

  const validateArchive = async archivePath => {
    const listing = await runSevenZip(['l', '-slt', '-sccUTF-8', archivePath]);
    const entrySection = String(listing).split(/^-{10,}\r?$/m).slice(1).join('\n');
    const listingRecords = entrySection.split(/\r?\n\r?\n/);
    let entryCount = 0;
    let expandedBytes = 0;
    for (const record of listingRecords) {
      const entryPath = record.match(/^Path = (.*)$/m)?.[1];
      if (!entryPath) continue;
      entryCount += 1;
      const normalizedEntryPath = entryPath.replace(/\\/g, '/');
      const normalizedPath = path.posix.normalize(normalizedEntryPath);
      if (normalizedPath === '..' || normalizedPath.startsWith('../') || normalizedPath.startsWith('/') || /^[a-z]:/i.test(normalizedPath)) {
        throw new Error(`Unsafe archive path rejected: ${entryPath}`);
      }
      if (/^(?:Symbolic Link|Hard Link) = /m.test(record)) throw new Error(`Archive links are not supported: ${entryPath}`);
      const entrySize = Number(record.match(/^Size = (\d+)$/m)?.[1] || 0);
      expandedBytes += entrySize;
      if (entryCount > 50000) throw new Error('Archive contains more than 50,000 entries.');
      if (expandedBytes > 100 * 1024 ** 3) throw new Error('Archive expands to more than 100 GB.');
    }
  };
  await validateArchive(sourcePath);

  const archiveFileName = path.basename(String(requestedFileName || sourcePath));
  const archiveBaseName = archiveFileName.replace(/\.(?:tar\.(?:gz|bz2|xz|lzma)|tgz|tbz|tbz2|txz)$/i, '').replace(/\.[^.]+$/, '')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '') || 'extracted-files';
  let extractionPath = path.join(outputDirectory, archiveBaseName);
  for (let suffix = 1; await fs.stat(extractionPath).then(() => true, () => false); suffix += 1) {
    extractionPath = path.join(outputDirectory, `${archiveBaseName} (${suffix})`);
  }
  await fs.mkdir(extractionPath, { recursive: false });

  const containsTarLayer = /\.(?:tar\.(?:gz|bz2|xz|lzma)|tgz|tbz|tbz2|txz)$/i.test(archiveFileName);
  const intermediateDirectory = path.join(app.getPath('temp'), 'fcp-archive-nested', randomUUID());
  try {
    if (containsTarLayer) {
      await fs.mkdir(intermediateDirectory, { recursive: true });
      await runSevenZip(['x', '-y', '-bso0', '-bsp0', `-o${intermediateDirectory}`, sourcePath]);
      const innerArchives = (await fs.readdir(intermediateDirectory)).filter(name => name.toLowerCase().endsWith('.tar'));
      if (innerArchives.length !== 1) throw new Error('Could not locate the TAR contents inside this compressed archive.');
      const innerArchivePath = path.join(intermediateDirectory, innerArchives[0]);
      await validateArchive(innerArchivePath);
      await runSevenZip(['x', '-y', '-bso0', '-bsp0', `-o${extractionPath}`, innerArchivePath]);
    } else {
      await runSevenZip(['x', '-y', '-bso0', '-bsp0', `-o${extractionPath}`, sourcePath]);
    }
    return extractionPath;
  } catch (error) {
    await fs.rm(extractionPath, { recursive: true, force: true });
    throw error;
  } finally {
    await fs.rm(intermediateDirectory, { recursive: true, force: true });
  }
});
ipcMain.handle('fcp:delete-source-file', async (_event, filePath) => {
  const sourcePath = path.resolve(String(filePath));
  if (!sourcePath || sourcePath === path.parse(sourcePath).root) throw new Error('Refusing to delete an invalid source path.');
  await fs.rm(sourcePath, { force: false });
  return true;
});
ipcMain.handle('fcp:disable-wallpaper', async () => {
  const current = await readWallpaperConfig();
  await writeWallpaperConfig(false, current.path || '');
  return { enabled: false, path: current.path, dataUrl: null };
});
ipcMain.handle('fcp:convert-media', async (event, fileData, fileName, targetFormat) => {
  const workDir = path.join(app.getPath('temp'), 'fcp', randomUUID());
  const extension = path.extname(fileName) || '.bin';
  const inputPath = typeof fileData === 'string' ? fileData : path.join(workDir, `input${extension}`);
  const outputPath = path.join(workDir, `output.${String(targetFormat).toLowerCase()}`);

  await fs.mkdir(workDir, { recursive: true });
  if (typeof fileData !== 'string') {
    await fs.writeFile(inputPath, Buffer.from(fileData));
  }

  try {
    const args = ['-y', '-i', inputPath];
    const targetFormatUpper = String(targetFormat).toUpperCase();
    const isVideoOutput = ['MP4', 'WEBM', 'WMV', 'MKV'].includes(targetFormatUpper);
    const isAudioOutput = ['MP3', 'WAV', 'FLAC', 'OGG'].includes(targetFormatUpper);
    const canUseGpuEncoder = gpuInfo.hasDedicatedGpu && isVideoOutput && ['MP4', 'MKV'].includes(targetFormatUpper) && gpuInfo.encoder;

    const buildArgs = (useGpu = true) => {
      const finalArgs = [...args];

      if (useGpu && canUseGpuEncoder) {
        finalArgs.push('-c:v', gpuInfo.encoder);
        finalArgs.push('-preset', gpuInfo.vendor === 'nvidia' ? 'p4' : 'medium');
        finalArgs.push('-pix_fmt', 'yuv420p');
        finalArgs.push('-movflags', '+faststart');
      }

      if (targetFormatUpper === 'HEIC') {
        finalArgs.push('-c:v', 'libx265', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-f', 'mp4', '-brand', 'heic');
      }

      if (isAudioOutput) {
        finalArgs.push('-map', '0:a:0', '-vn', '-map_metadata', '-1', '-map_chapters', '-1');
      }

      finalArgs.push('-progress', 'pipe:2', '-nostats');
      finalArgs.push(outputPath);
      return finalArgs;
    };

    const runFfmpeg = async (ffmpegArgs, useGpu = true) => {
      await new Promise((resolve, reject) => {
        const process = spawn(nativeFfmpegPath, ffmpegArgs, { windowsHide: true });
        activeConversionProcess = process;
        let errorOutput = '';
        let lastOutputAt = Date.now();
        let durationSeconds = 0;
        const startedAt = Date.now();

        const timeoutId = setInterval(() => {
          if (Date.now() - lastOutputAt > 60000) {
            if (!process.killed) process.kill('SIGKILL');
            clearInterval(timeoutId);
            reject(new Error(useGpu ? 'Conversion stalled for over 60 seconds, switching to software encoding.' : 'Conversion stalled for over 60 seconds and was cancelled.'));
          }
        }, 2000);

        process.stderr.on('data', data => {
          const text = data.toString();
          errorOutput += text;
          lastOutputAt = Date.now();
          const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
          if (durationMatch) {
            durationSeconds = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
          }
          const timeMatch = text.match(/out_time_ms=(\d+)/);
          if (timeMatch && durationSeconds > 0) {
            const currentSeconds = Number(timeMatch[1]) / 1000000;
            const progress = Math.min(100, Math.max(0, Math.round((currentSeconds / durationSeconds) * 100)));
            const elapsedSeconds = (Date.now() - startedAt) / 1000;
            const etaSeconds = progress > 0 ? Math.max(0, Math.round((elapsedSeconds / (progress / 100)) - elapsedSeconds)) : null;
            event.sender.send('fcp:media-progress', { fileName, progress, etaSeconds });
          }
        });
        process.on('error', error => {
          clearInterval(timeoutId);
          reject(error);
        });
        process.on('close', code => {
          clearInterval(timeoutId);
          activeConversionProcess = null;
          if (code === 0) resolve();
          else reject(new Error(summarizeFfmpegError(errorOutput) || `FFmpeg exited with code ${code}`));
        });
      });
    };

    try {
      await runFfmpeg(buildArgs(true), true);
    } catch (error) {
      const message = String(error || '');
      if (canUseGpuEncoder && /stalled for over 60 seconds|SIGKILL|timed out/i.test(message)) {
        await runFfmpeg(buildArgs(false), false);
      } else {
        throw error;
      }
    }

    return await fs.readFile(outputPath);
  } finally {
    activeConversionProcess = null;
    await fs.rm(workDir, { recursive: true, force: true });
  }
});
ipcMain.handle('fcp:read-file', (_event, filePath) => fs.readFile(filePath));
ipcMain.handle('fcp:write-file', async (_event, filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from(data));
  return true;
});
ipcMain.handle('fcp:save-file', async (_event, options) => {
  const saveOptions = options || {};
  const data = saveOptions.data;
  const fileName = path.basename(String(saveOptions.fileName || saveOptions.defaultPath || 'download'));
  let filePath;

  if (saveOptions.outputDirectory) {
    filePath = path.join(saveOptions.outputDirectory, fileName);
  } else {
    const dialogOptions = { ...saveOptions, defaultPath: fileName };
    delete dialogOptions.data;
    delete dialogOptions.filePath;
    delete dialogOptions.outputDirectory;
    const result = await dialog.showSaveDialog(dialogOptions);
    if (result.canceled) return null;
    filePath = result.filePath;
  }

  if (saveOptions.filePath) {
    const sourcePath = resolveTempZipPath(saveOptions.filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.copyFile(sourcePath, filePath);
  } else if (data !== undefined) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(data));
  }

  return filePath;
});

function loadDevelopmentPage(window, attempt = 0) {
  window.loadURL(developmentUrl).catch(() => {
    if (attempt < 50) {
      setTimeout(() => loadDevelopmentPage(window, attempt + 1), 200);
    }
  });
}

app.whenReady().then(async () => {
  await fs.rm(path.join(app.getPath('temp'), 'fcp-staging'), { recursive: true, force: true });
  const splash = createSplashWindow();
  const window = createWindow();
  window.splashWindow = splash;

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function detectGpu() {
  if (process.platform !== 'win32') {
    return { hasDedicatedGpu: true, vendor: 'unknown', name: 'system GPU', encoder: null };
  }

  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress"
  ], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  const rawNames = result.status === 0 ? result.stdout.trim() : '';
  let names;
  try {
    names = rawNames ? JSON.parse(rawNames) : [];
  } catch {
    names = [];
  }
  if (!Array.isArray(names)) names = [names];

  const gpuNames = names.filter(Boolean).map(String);
  const dedicated = gpuNames.find(name =>
    /NVIDIA|GeForce|RTX|GTX|Quadro|Tesla|Radeon RX|Radeon Pro|Arc|Intel.*Arc|Intel.*UHD|Intel.*Iris/i.test(name)
  );

  const encoder = dedicated && /NVIDIA|GeForce|RTX|GTX|Quadro|Tesla/i.test(dedicated)
    ? 'h264_nvenc'
    : dedicated && /AMD|Radeon/i.test(dedicated)
      ? 'h264_amf'
      : dedicated && /Intel|Arc/i.test(dedicated)
        ? 'h264_qsv'
        : null;

  const vendor = dedicated && /NVIDIA|GeForce|RTX|GTX|Quadro|Tesla/i.test(dedicated)
    ? 'nvidia'
    : dedicated && /AMD|Radeon/i.test(dedicated)
      ? 'amd'
      : dedicated && /Intel|Arc/i.test(dedicated)
        ? 'intel'
        : 'integrated';

  return {
    hasDedicatedGpu: Boolean(dedicated),
    vendor,
    name: dedicated || gpuNames[0] || 'unknown',
    encoder
  };
}