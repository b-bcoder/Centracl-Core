const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('centralCore', {
  getLocalUsername: () => ipcRenderer.invoke('app:get-local-username')
});

contextBridge.exposeInMainWorld('electronAPI', {
  getFfmpegPath: () => ipcRenderer.invoke('fcp:get-ffmpeg-path'),
  getGpuInfo: () => ipcRenderer.invoke('fcp:get-gpu-info'),
  cancelConversion: () => ipcRenderer.invoke('fcp:cancel-conversion'),
  convertMedia: (fileData, fileName, targetFormat) => ipcRenderer.invoke('fcp:convert-media', fileData, fileName, targetFormat),
  onMediaProgress: callback => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('fcp:media-progress', listener);
    return () => ipcRenderer.removeListener('fcp:media-progress', listener);
  },
  transcribeAudio: (fileData, fileName, targetFormat) => ipcRenderer.invoke('fcp:transcribe-audio', fileData, fileName, targetFormat),
  onTranscriptionProgress: callback => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('fcp:transcription-progress', listener);
    return () => ipcRenderer.removeListener('fcp:transcription-progress', listener);
  },
  getFilePath: file => webUtils.getPathForFile(file),
  stageFile: (fileData, fileName) => ipcRenderer.invoke('fcp:stage-file', fileData, fileName),
  readFile: filePath => ipcRenderer.invoke('fcp:read-file', filePath),
  cleanupStagedFile: filePath => ipcRenderer.invoke('fcp:cleanup-staged-file', filePath),
  deleteSourceFile: filePath => ipcRenderer.invoke('fcp:delete-source-file', filePath),
  chooseOutputDirectory: () => ipcRenderer.invoke('fcp:choose-output-directory'),
  saveFile: options => ipcRenderer.invoke('fcp:save-file', options),
  getWallpaper: () => ipcRenderer.invoke('fcp:get-wallpaper'),
  chooseWallpaper: () => ipcRenderer.invoke('fcp:choose-wallpaper'),
  disableWallpaper: () => ipcRenderer.invoke('fcp:disable-wallpaper'),
  getOnboardingComplete: () => ipcRenderer.invoke('fcp:get-onboarding-complete'),
  setOnboardingComplete: () => ipcRenderer.invoke('fcp:set-onboarding-complete'),
  getVaultStatus: () => ipcRenderer.invoke('fcp:get-vault-status')
});
