# Getting started with File Converter Pro

## Installation

1. Open the `release` folder.
2. Run the latest installer, for example `File Converter Pro Setup 1.0.2.exe`.
3. Follow the Windows installation steps.
4. Open File Converter Pro from the Start menu or shortcut.

Use the complete `.exe` installer. The `.blockmap` and `.__uninstaller.exe` files are not installers.

## In 5 steps

1. Start `File Converter Pro`.
2. Click `Browse Files` or `Browse Folder`.
3. Choose the desired output format.
4. Click `Convert All`.
5. Click `Download` to save the result.

When an output folder is configured in Settings, downloads are saved there automatically without opening the Windows save dialog. Without an output folder, Windows asks where to save the file. Conversion still works without an output folder, but source files are not deleted automatically.

## Encrypted vault

1. Open Settings and choose an output folder.
2. Enable `Set output folder as vault`.
3. Set a password of at least 10 characters and choose a quota.
4. During ZIP export, choose the vault as the destination.
5. Use `Open vault` in Settings to export or delete stored ZIP files.

Vault files are encrypted `.fcpv` containers. Windows Explorer cannot read their contents. The password is not stored; without it, the files cannot be recovered.

You can also drag files into the window.

## Audio transcription

Add an audio file, select `TXT` for text or `SRT` for subtitles, and click `Convert All`. Whisper is included in the installer and runs locally; no MSYS2 installation or internet connection is required. WAV files are normalized automatically.

## Important

The app checks at the start of the conversion whether each source file is still available in its original location. If a file has been deleted, moved, or is no longer accessible, an error message appears and the conversion of that file is not continued. The conversion for the other files continues as usual.

## Quick tips

- Use a valid, undamaged source file.
- Choose a suitable resolution for the desired result.
- Large video and audio files may take longer.
- Download multiple results together as a ZIP archive.
- Press `F11` to toggle fullscreen.

The app processes files locally. Files are not uploaded.

## Background

Click the gear icon next to the light/dark toggle. In Settings, choose `Add background` or `Change background`. Choose `Turn background off` to return to the default background. Use an image with the same aspect ratio as your screen, otherwise the background may be stretched.
