# File Converter Pro (FCP)

**File Converter Pro** is a program for Windows that allows you to convert, edit, and process a wide variety of files locally on your own computer.

Your files are **never sent to any online service**. All conversions and transcriptions happen directly and privately on your machine.

FCP can process images, videos, audio, PDFs, Office documents, 3D models, archives, and much more.

An internet connection is only required if you choose to check whether a new version of FCP is available.

## What can you do with FCP?

### 🖼️ Images

Convert images to popular formats, including:

* JPG
* PNG
* WEBP
* HEIC
* AVIF
* PDF
* ICO
* SVG

You can also merge multiple images together into a single PDF document.

### 🎬 Video

Convert videos to:

* MP4
* WEBM
* WMV
* MKV

During conversion, you can monitor live progress and an estimated remaining time (ETA).

### 🎵 Audio

Convert audio files to:

* MP3
* WAV
* FLAC
* OGG

You can also transcribe spoken audio locally into text.

Available output formats:

* TXT (plain text transcript)
* SRT (timestamped subtitles)

### 📄 PDF

FCP can extract text directly from PDF documents.

### 📝 Word Documents

Convert DOCX files to:

* TXT
* HTML
* PDF

### 📊 Excel Spreadsheets

Convert XLSX workbooks to:

* CSV (uses the first sheet)
* JSON
* TXT
* PDF

### 📦 Archives

FCP can extract files from common archive formats, including:

* ZIP
* 7Z
* TAR
* GZ / TGZ
* BZ2 / TBZ
* XZ / TXZ
* LZMA
* CAB

FCP validates archives for malicious or unsafe content and refuses archives containing dangerous file paths, unsafe links, or an excessive number of files (zip-bomb protection).

### 🗂️ Batch Processing & Folders

You don't have to convert files one by one.

FCP supports:

* Multiple files at once
* Entire folders
* Large batches
* Retrying failed conversions
* Exporting results packaged as ZIP archives

You can easily select your own custom output folder.

## 🔐 Private and Local

FCP was built from the ground up with local processing as its core principle.

Your files are never uploaded to an external server. Conversions and transcriptions take place entirely on your device.

In addition, you can designate a local folder as an **Encrypted Vault**.

The Vault:

* Encrypts stored files using AES-256-GCM
* Obfuscates filenames of stored ZIP files
* Requires a master password to unlock and access contents
* Allows you to export or delete files directly from within FCP

**Important note:** Passwords are never saved by FCP. If you forget your master password, files stored inside the vault cannot be recovered.

## 💾 Useful Features

FCP includes:

* Custom output directory selection
* Simultaneous batch processing of files and folders
* Retry actions for individual or all failed jobs
* Real-time progress and remaining time estimates
* ZIP export for completed conversions
* Optional AES-256 password protection for ZIP files
* Optional automatic deletion of source files after successful conversion
* Custom background wallpaper support
* Dark and light themes
* Borderless fullscreen toggle with `F11`
* Multilingual user interface
* Interactive first-run onboarding guide

### Keeping Source Files Safe

If you enable the option to automatically delete source files after conversion, files are first safely staged.

The original file is only removed after the new output file has been successfully verified.

This setting is disabled by default and requires explicit confirmation before conversion begins.

## 🌍 Languages

FCP comes with a multilingual interface and localized guides.

Available languages include:

* 🇳🇱 Dutch
* 🇬🇧 English
* 🇩🇪 German
* 🇫🇷 French
* 🇹🇷 Turkish
* 🇨🇳 Chinese
* 🇯🇵 Japanese

## 💻 System Requirements

FCP is a native, local application. Large batches, video encoding, and transcribing long audio files can utilize significant CPU, RAM, and disk storage.

### Minimum

* Windows 10 or newer (64-bit)
* 8 GB RAM
* 4-core / 8-thread CPU or equivalent
* SSD or HDD with sufficient free space for temporary cache and output
* A dedicated graphics card is not required, but can accelerate video conversions

### Recommended

* Windows 11 (64-bit)
* 16 GB RAM or more
* 8-core / 16-thread modern CPU (e.g., AMD Ryzen 7/9 or Intel Core i7/i9)
* NVMe SSD for fast temporary file read/write speeds
* Dedicated GPU for hardware-accelerated video encoding

> **Note:** During heavy conversion batches, elevated CPU usage is normal. Large files, large batches, and long audio transcriptions will actively utilize system resources.

## 📥 Developer Setup

Want to build or customize FCP yourself? You will need Node.js.

1. Download and install Node.js from [nodejs.org](https://nodejs.org/).
2. Open a terminal in the project directory.
3. Install dependencies:

```bash
npm install
```

4. Start FCP in development mode:

```bash
npm run dev
```

5. Package the Windows installer:

```bash
npm run dist
```

The compiled installer will be saved in the `release/` folder.

## 📥 Downloading FCP

End users do not need Node.js or the source code.

Simply download the latest Windows installer from the [FCP GitHub Releases](https://github.com/b-bcoder/FCP-File-Converter-Pro-Up-to-Date/releases) page and run the `.exe` setup wizard.

## 🛠️ Building FCP Yourself

Developers can clone the source code, install the required packages, and package a new Windows build using:

```bash
npm run dist
```

## 📁 Where Are Files Stored?

FCP uses several local Windows directories for settings, application updates, and temporary processing cache.

These are separate from your chosen output destination folder.

Temporary cache files are automatically cleaned up after successful completion.

## 📖 Documentation

Additional manuals and localized documentation are available under:

**`README Files & Short Guides`**

## 👨‍💻 Author

**B&B Coder**

## 📜 License

This project is distributed under the terms of the project's license.

Please refer to the project and release documentation for usage and distribution terms.
