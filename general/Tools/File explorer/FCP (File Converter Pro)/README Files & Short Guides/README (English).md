# File Converter Pro (FCP)

File Converter Pro is a Windows desktop application for fast, local conversion of images, videos, audio, Office documents, PDF files and 3D models, plus extraction of common archives. Files are not uploaded to an online service.

## Creator

**Author:** B&B Coder  
**Project:** FCP (File Converter Pro)

## Features

- Convert images to JPG, PNG, WEBP, HEIC, AVIF, PDF, ICO and SVG
- Convert video to MP4, WEBM, WMV and MKV
- Convert audio to MP3, WAV, FLAC and OGG
- Transcribe audio locally to TXT or SRT with Whisper
- Extract text from PDF files
- Convert DOCX documents to TXT, HTML or PDF
- Convert XLSX workbooks to CSV (first worksheet), JSON, TXT or PDF
- Extract ZIP, 7Z, TAR, GZ/TGZ, BZ2/TBZ, XZ/TXZ, LZMA and CAB archives
- Combine multiple images into one PDF
- Process files and folders in batches
- Change output resolution
- Set an output folder for converted files and downloads
- Optionally turn the output folder into an encrypted vault
- Open, export and delete vault ZIP files from inside the app
- Download results as a ZIP archive
- Protect ZIP archives with AES-256 encryption
- Protect vault contents with AES-256-GCM and Argon2id
- Multilingual interface and first-run guide
- Light and dark themes
- Adjustable background
- Borderless fullscreen with `F11`
- Dedicated-GPU detection and native FFmpeg in Electron

## System requirements

FCP is a local desktop app that performs conversion and transcription directly on your machine. Heavy workloads such as batch conversion, video transcoding and Whisper transcription can use a lot of CPU, RAM and temporary disk space.

### Minimum

- Windows 10 or newer (64-bit)
- 8 GB RAM
- 4-core / 8-thread CPU or better
- SSD or HDD with enough free space for temporary files and converted output
- Dedicated GPU optional, but recommended for smoother video conversion

### Recommended

- Windows 11 (64-bit)
- 16 GB RAM or more
- 8-core / 16-thread CPU or better, such as a modern Ryzen 7/9 or Intel i7/i9
- NVMe SSD preferred for faster temporary file handling and output
- Dedicated GPU recommended for accelerated video processing and better overall responsiveness

> Note: high CPU usage during conversion is normal. FCP uses native FFmpeg and the bundled Whisper engine locally, so modern multi-core CPUs can be fully utilized while processing large media files or long audio transcriptions.

## Installation

1. Open the `release` folder.
2. Run the latest installer, for example `File Converter Pro Setup 1.0.2.exe`.
3. Follow the Windows installation steps.
4. Launch the app from the Start menu or shortcut.

Use the complete `.exe` installer. A `.blockmap` file and a `.__uninstaller.exe` file are not installers.
After installation, Windows creates a desktop shortcut. The app starts automatically in borderless fullscreen mode. The installed files are stored locally in `%LOCALAPPDATA%\Programs\bestandsconverter`.

### Windows file locations

After installation, FCP uses these locations:

- Update files: `%LOCALAPPDATA%\bestandsconverter-updater`
- Installed application files: `%LOCALAPPDATA%\Programs\bestandsconverter`
- Settings and user data: `%APPDATA%\bestandsconverter`

On your computer, these variables expand to `C:\Users\<username>\AppData\Local\bestandsconverter-updater`, `C:\Users\<username>\AppData\Local\Programs\bestandsconverter` and `C:\Users\<username>\AppData\Roaming\bestandsconverter`. These locations are separate from the selected output folder and temporary conversion folders.

## Using the app

1. Add files with `Browse Files` or a folder with `Browse Folder`.
2. You can also drag files into the window.
3. Select an output format and, if needed, a resolution for each file.
4. Use bulk actions when processing multiple files.
5. Select `Convert All`.
6. Download results individually or as a ZIP archive.

When an output folder is configured in Settings, individual downloads and ZIP archives are saved there automatically without opening the Windows save dialog. Without an output folder, Windows asks where each download should be saved.

### Encrypted vault

In Settings, choose an output folder and enable `Set output folder as vault`. Choose a password of at least 10 characters and a storage quota. ZIP export then lets you choose between the normal output folder and the vault.

The vault stores ZIP files as encrypted `.fcpv` containers in a hidden `.fcp-vault` folder. Contents and new ZIP filenames are protected with AES-256-GCM; Argon2id derives the encryption key from the password. Windows Explorer can see the container files but cannot read them. Use `Open vault` in Settings to list, export or delete stored files.

The password is never stored. Without it, encrypted files cannot be recovered. Removing the output folder disables the vault configuration but does not delete existing vault data. The quota limits stored data and does not reserve free disk space in Windows Explorer.

### Audio transcription

1. Add a WAV, MP3, M4A, OGG or another supported audio file.
2. Select `TXT` for plain text or `SRT` for subtitles.
3. Select `Convert All` and wait for the transcription to finish.
4. Download the generated transcript.

Transcription runs locally with the Whisper engine included in the installer. No MSYS2, separate Whisper installation or internet connection is required. WAV files are normalized automatically before transcription.

Conversions can run without an output folder. Source files are only deleted automatically when an output folder is configured and the converted file has been saved there successfully.

For the best result, use a valid source file, a suitable output format and an appropriate resolution. Large media files may take longer to process.

## GPU acceleration

The app checks the installed video adapter at startup. If only an integrated GPU is detected, Electron hardware acceleration is disabled. With a dedicated GPU, it remains enabled. NVIDIA GPUs can use `h264_nvenc` and AMD GPUs can use `h264_amf` for supported video output. Audio is processed natively through FFmpeg.

## Shortcuts

- `F11`: toggle fullscreen

The Electron menu bar is hidden. The app starts in borderless fullscreen mode.

## Set a background

Click the gear icon next to the light/dark toggle on the home page. Choose `Add background` or `Change background` and select an image or an MP4/WebM video. Videos play muted and loop. Choose `Turn background off` to return to the default background. The choice is stored locally and checked on every startup.

## First run

On the first launch, the user chooses a language. A short guide then appears in that language. Completion is stored with the app's local user data, so the guide is not shown again on later launches.

## Development

Requirements: Windows 10 or later, Node.js 18 or later and npm.

```powershell
npm install
npm rebuild ffmpeg-static --foreground-scripts
npm run dev
```

Other commands:

```powershell
npm run lint
npm run build
npm run dist
```

The installer is created at `release/File Converter Pro Setup <version>.exe`.

## Technologies

- React and React DOM: user interface
- TypeScript and Vite: development and builds
- Electron: desktop runtime
- electron-builder: Windows installer
- FFmpeg and `ffmpeg-static`: video and audio conversion
- PDF.js and jsPDF: reading and creating PDFs
- FFmpeg: HEIC/AVIF support
- ImageTracerJS: SVG conversion
- zip.js: ZIP archives and AES-256 encryption
- `@node-rs/argon2`: Argon2id key derivation for the vault
- Tailwind CSS, PostCSS and Autoprefixer: styling
- `concurrently`: starts Vite and Electron together

## Technology and privacy

The renderer uses `contextIsolation: true` and `nodeIntegration: false`. Native functionality is exposed through the limited preload IPC API. Conversion is performed locally. Internet access is only required for the initial npm installation.

## Credits

**Creator / Author:** B&B Coder  
**Project:** File Converter Pro (FCP)
