const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');

const projectRoot = path.resolve(__dirname, '..');
const runtimeDirectory = path.join(projectRoot, 'node_modules', '.cache', 'fcp-whisper-runtime');
const whisperArchiveUrl = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.5.0/whisper-bin-x64.zip';
const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin?download=true';
const requiredFiles = ['main.exe', 'whisper.dll', 'ggml-base.en.bin'];

async function isRuntimeReady() {
  try {
    const [executable, library, model] = await Promise.all(
      requiredFiles.map(fileName => fs.stat(path.join(runtimeDirectory, fileName)))
    );
    return executable.size > 0 && library.size > 0 && model.size > 100 * 1024 * 1024;
  } catch {
    return false;
  }
}

async function downloadFile(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status} ${response.statusText}): ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

async function prepareRuntime() {
  if (await isRuntimeReady()) {
    console.log('Whisper runtime is already prepared.');
    return;
  }

  if (process.platform !== 'win32') {
    throw new Error('Preparing the Windows Whisper runtime requires Windows PowerShell.');
  }

  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'fcp-whisper-'));
  const archivePath = path.join(temporaryDirectory, 'whisper-bin-x64.zip');
  const extractedDirectory = path.join(temporaryDirectory, 'extracted');
  const stagedDirectory = path.join(runtimeDirectory, '.staged');

  try {
    await fs.mkdir(extractedDirectory, { recursive: true });
    await fs.mkdir(stagedDirectory, { recursive: true });
    console.log('Downloading official whisper.cpp v1.5.0 Windows x64 runtime...');
    await downloadFile(whisperArchiveUrl, archivePath);

    const escapePowerShellPath = value => value.replace(/'/g, "''");
    const extraction = spawnSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath '${escapePowerShellPath(archivePath)}' -DestinationPath '${escapePowerShellPath(extractedDirectory)}' -Force`
    ], { encoding: 'utf8', windowsHide: true });

    if (extraction.error || extraction.status !== 0) {
      throw extraction.error || new Error(extraction.stderr || 'Could not extract the Whisper runtime archive.');
    }

    for (const fileName of ['main.exe', 'whisper.dll']) {
      await fs.copyFile(path.join(extractedDirectory, fileName), path.join(stagedDirectory, fileName));
    }

    console.log('Downloading the offline base.en Whisper model...');
    await downloadFile(modelUrl, path.join(stagedDirectory, 'ggml-base.en.bin'));

    const model = await fs.stat(path.join(stagedDirectory, 'ggml-base.en.bin'));
    if (model.size <= 100 * 1024 * 1024) {
      throw new Error(`The downloaded Whisper model is incomplete (${model.size} bytes).`);
    }

    await fs.mkdir(runtimeDirectory, { recursive: true });
    for (const fileName of requiredFiles) {
      await fs.rename(path.join(stagedDirectory, fileName), path.join(runtimeDirectory, fileName));
    }
    console.log('Whisper runtime prepared.');
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    await fs.rm(stagedDirectory, { recursive: true, force: true });
  }
}

prepareRuntime().catch(error => {
  console.error(`Whisper runtime preparation failed: ${error.message}`);
  process.exitCode = 1;
});