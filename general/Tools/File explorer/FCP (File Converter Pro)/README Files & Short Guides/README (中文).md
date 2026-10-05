# File Converter Pro (FCP)

File Converter Pro 是一款适用于 Windows 的桌面应用程序，用于快速本地转换图像、视频、音频和 PDF 文件。文件不会上传到在线服务。

## 制作者

**作者：** B&B Coder  
**项目：** FCP (File Converter Pro)

## 功能

- 将图像转换为 JPG、PNG、WEBP、HEIC、AVIF、PDF、ICO 和 SVG
- 将视频转换为 MP4、WEBM、WMV 和 MKV
- 将音频转换为 MP3、WAV、FLAC 和 OGG
- 使用 Whisper 在本地将音频转录为 TXT 或 SRT
- 从 PDF 文件中提取文本
- 将多张图像合并为一个 PDF
- 批量处理文件和文件夹
- 更改输出分辨率
- 为转换文件和下载内容设置输出文件夹
- 可选择将输出文件夹设置为加密保险箱
- 在应用内打开、导出和删除保险箱中的 ZIP 文件
- 将结果下载为 ZIP 压缩包
- 使用 AES-256 密码保护 ZIP 文件
- 使用 AES-256-GCM 和 Argon2id 保护保险箱内容
- 多语言界面和首次启动指南
- 浅色和深色主题
- 可调背景
- 使用 `F11` 的无边框全屏模式
- 专用 GPU 检测和 Electron 原生 FFmpeg

## 系统要求

FCP 是一款在本机直接执行转换和转录的本地桌面应用。批量转换、视频转码和 Whisper 转录等较重的任务可能会占用大量 CPU、内存和临时磁盘空间。

### 最低要求

- Windows 10 或更高版本（64 位）
- 8 GB RAM
- 4 核 / 8 线程 CPU 或更高
- 具备足够可用空间的 SSD 或 HDD，用于临时文件和转换输出
- 可选专用 GPU，但建议用于更流畅的视频转换

### 推荐配置

- Windows 11（64 位）
- 16 GB RAM 或更高
- 8 核 / 16 线程 CPU 或更高，例如较新的 Ryzen 7/9 或 Intel i7/i9
- 建议使用 NVMe SSD，以获得更快的临时文件处理和输出速度
- 建议使用专用 GPU 以加速视频处理并提升整体响应速度

> 说明：转换过程中 CPU 使用率较高是正常现象。FCP 会在本地使用原生 FFmpeg 和内置 Whisper 引擎，因此现代多核 CPU 在处理大媒体文件或长音频转录时可以被充分利用。

## 安装

1. 打开 `release` 文件夹。
2. 运行最新的安装程序，例如 `File Converter Pro Setup 1.0.2.exe`。
3. 按照 Windows 安装步骤操作。
4. 从开始菜单或快捷方式启动应用。

请使用完整的 `.exe` 安装程序。`.blockmap` 文件和 `.__uninstaller.exe` 文件不是安装程序。
安装后，Windows 会在桌面创建快捷方式。应用默认会自动以无边框全屏模式启动。已安装的文件位于 `%LOCALAPPDATA%\Programs\bestandsconverter`。

### Windows 文件位置

安装后，FCP 使用以下本地位置：

- 更新文件：`%LOCALAPPDATA%\bestandsconverter-updater`
- 已安装的应用程序文件：`%LOCALAPPDATA%\Programs\bestandsconverter`
- 设置和用户数据：`%APPDATA%\bestandsconverter`

在您的计算机上，这些变量例如会展开为 `C:\Users\<用户名>\AppData\Local\bestandsconverter-updater`、`C:\Users\<用户名>\AppData\Local\Programs\bestandsconverter` 和 `C:\Users\<用户名>\AppData\Roaming\bestandsconverter`。这些位置与所选输出文件夹及临时转换文件夹分开。

## 使用方法

1. 使用 `Browse Files` 添加文件，或使用 `Browse Folder` 添加文件夹。
2. 也可以将文件拖入窗口。
3. 为每个文件选择输出格式，并在需要时选择分辨率。
4. 处理多个文件时可以使用批量操作。
5. 选择 `Convert All`。
6. 单独下载结果，或将全部结果下载为 ZIP 文件。

在设置中指定输出文件夹后，单个下载和 ZIP 文件会自动保存到该文件夹，不会打开 Windows 保存对话框。未指定输出文件夹时，Windows 会询问每个下载文件的保存位置。

### 加密保险箱

在设置中选择输出文件夹，然后启用“将输出文件夹设置为保险箱”。设置至少 10 个字符的密码和存储配额。导出 ZIP 时，可以选择普通输出文件夹或保险箱。

保险箱会将 ZIP 文件作为加密的 `.fcpv` 容器存储在隐藏的 `.fcp-vault` 文件夹中。内容和新的 ZIP 文件名使用 AES-256-GCM 保护；Argon2id 根据密码派生加密密钥。Windows 文件资源管理器可以看到容器，但无法读取或解密。使用设置中的“打开保险箱”可以列出、导出或删除文件。

应用不会保存密码。没有密码就无法恢复加密文件。删除输出文件夹只会禁用保险箱配置，不会删除已有的保险箱数据。配额限制保险箱内容大小，但不会在 Windows 文件资源管理器中预留磁盘空间。

### 音频转录

1. 添加 WAV、MP3、M4A、OGG 或其他受支持的音频文件。
2. 选择 `TXT` 生成纯文本，或选择 `SRT` 生成字幕。
3. 选择 `Convert All` 并等待转录完成。
4. 下载生成的转录文件。

转录使用安装程序中包含的 Whisper 在本地运行。不需要 MSYS2、单独安装 Whisper 或互联网连接。WAV 文件会在转录前自动标准化。

即使未设置输出文件夹，也可以进行转换。只有在设置了输出文件夹并且转换文件成功保存到该文件夹后，源文件才会被自动删除。

为了获得最佳效果，请使用有效的源文件、合适的输出格式和适当的分辨率。大型媒体文件可能需要更长的处理时间。

## GPU 加速

应用启动时会检查视频适配器。如果只检测到集成 GPU，Electron 会关闭硬件加速。如果检测到独立 GPU，硬件加速会保持开启。对于支持的视频输出，NVIDIA GPU 可使用 `h264_nvenc`，AMD GPU 可使用 `h264_amf`。音频通过原生 FFmpeg 处理。

## 快捷键

- `F11`：切换全屏模式

Electron 菜单栏已隐藏。应用默认以无边框全屏模式启动。

## 首次启动

首次启动时请选择语言。随后会以所选语言显示简短指南。语言选择会保存在本地，指南不会再次显示。

## 开发

要求：Windows 10 或更高版本、Node.js 18 或更高版本以及 npm。

```powershell
npm install
npm rebuild ffmpeg-static --foreground-scripts
npm run dev
```

其他命令：

```powershell
npm run lint
npm run build
npm run dist
```

安装程序会生成在 `release/File Converter Pro Setup <版本>.exe`。

## 技术

- React 和 React DOM：用户界面
- TypeScript 和 Vite：开发和构建
- Electron：桌面运行环境
- electron-builder：Windows 安装程序
- FFmpeg 和 `ffmpeg-static`：视频和音频转换
- PDF.js 和 jsPDF：读取和创建 PDF
- zip.js：ZIP 文件和 AES-256 加密
- AES-256-GCM：保险库内容加密
- Argon2id：基于密码的保险库密钥派生
- Node.js crypto API：安全的文件与保险库处理
- Tailwind CSS、PostCSS 和 Autoprefixer：样式
- `concurrently`：同时启动 Vite 和 Electron

## 技术与隐私

渲染进程使用 `contextIsolation: true` 和 `nodeIntegration: false`。原生功能通过受限的 preload IPC API 提供。转换过程在本地完成。只有首次 npm 安装需要互联网。

## 设置背景

在主页点击明暗主题切换按钮旁边的齿轮图标。选择 `添加背景` 或 `更改背景`，然后选择图片。选择 `关闭背景` 可恢复默认背景。设置会保存到本地 `config.json`，并在每次启动时检查。为避免图片变形，请使用与屏幕宽高比相同的背景图片。

## 致谢

**制作者 / 作者：** B&B Coder  
**项目：** File Converter Pro (FCP)
