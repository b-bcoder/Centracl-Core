# File Converter Pro (FCP)

File Converter Pro ist eine Windows-Desktop-Anwendung für die schnelle, lokale Konvertierung von Bildern, Videos, Audiodateien und PDF-Dateien. Dateien werden nicht zu einem Online-Dienst hochgeladen.

## Ersteller

**Autor:** B&B Coder  
**Projekt:** FCP (File Converter Pro)

## Funktionen

- Bilder in JPG, PNG, WEBP, HEIC, AVIF, PDF, ICO und SVG konvertieren
- Videos in MP4, WEBM, WMV und MKV konvertieren
- Audio in MP3, WAV, FLAC und OGG konvertieren
- Audio lokal mit Whisper in TXT oder SRT transkribieren
- Text aus PDF-Dateien extrahieren
- Mehrere Bilder zu einer PDF-Datei zusammenfassen
- Dateien und Ordner stapelweise verarbeiten
- Ausgabeauflösung ändern
- Einen Ausgabeordner für konvertierte Dateien und Downloads festlegen
- Den Ausgabeordner optional als verschlüsselten Tresor festlegen
- Tresor-ZIP-Dateien in der App öffnen, exportieren und löschen
- Ergebnisse als ZIP-Datei herunterladen
- ZIP-Dateien mit AES-256-Passwort schützen
- Tresorinhalte mit AES-256-GCM und Argon2id schützen
- Mehrsprachige Oberfläche und Anleitung beim ersten Start
- Helles und dunkles Design
- Einstellbarer Hintergrund
- Randloser Vollbildmodus mit `F11`
- Erkennung dedizierter GPUs und natives FFmpeg in Electron

## Systemanforderungen

FCP ist eine lokale Desktop-App, die Konvertierungen und Transkriptionen direkt auf Ihrem Rechner ausführt. Bei anspruchsvollen Aufgaben wie Batch-Konvertierungen, Videotranscoding und Whisper-Transkriptionen können CPU, Arbeitsspeicher und temporärer Speicherplatz stark beansprucht werden.

### Mindestanforderungen

- Windows 10 oder neuer (64-Bit)
- 8 GB RAM
- CPU mit 4 Kernen / 8 Threads oder besser
- SSD oder HDD mit ausreichend freiem Speicherplatz für temporäre Dateien und Ausgabedateien
- Dedizierte GPU optional, aber für flüssigere Videokonvertierungen empfohlen

### Empfohlen

- Windows 11 (64-Bit)
- 16 GB RAM oder mehr
- CPU mit 8 Kernen / 16 Threads oder besser, z. B. modernes Ryzen 7/9 oder Intel i7/i9
- NVMe-SSD bevorzugt für schnellere temporäre Dateiverarbeitung und Ausgaben
- Dedizierte GPU empfohlen für beschleunigte Videobearbeitung und bessere Gesamtreaktion

> Hinweis: Hohe CPU-Auslastung während der Konvertierung ist normal. FCP verwendet lokal native FFmpeg- und Whisper-Engines, daher können moderne Mehrkernprozessoren bei großen Mediendateien oder langen Audio-Transkriptionen vollständig ausgelastet werden.

## Installation

1. Öffnen Sie den Ordner `release`.
2. Starten Sie den neuesten Installer, zum Beispiel `File Converter Pro Setup 1.0.2.exe`.
3. Folgen Sie den Windows-Installationsschritten.
4. Starten Sie die App über das Startmenü oder die Verknüpfung.

Verwenden Sie die vollständige `.exe`-Installationsdatei. Eine `.blockmap`-Datei und eine `.__uninstaller.exe`-Datei sind keine Installer.
Nach der Installation erstellt Windows eine Desktopverknüpfung. Die App startet standardmäßig automatisch im randlosen Vollbildmodus. Die installierten Dateien befinden sich lokal unter `%LOCALAPPDATA%\Programs\bestandsconverter`.

### Windows-Speicherorte

Nach der Installation verwendet FCP diese lokalen Speicherorte:

- Update-Dateien: `%LOCALAPPDATA%\bestandsconverter-updater`
- Installierte Programmdateien: `%LOCALAPPDATA%\Programs\bestandsconverter`
- Einstellungen und Benutzerdaten: `%APPDATA%\bestandsconverter`

Auf Ihrem Computer werden diese Variablen beispielsweise zu `C:\Users\<Benutzername>\AppData\Local\bestandsconverter-updater`, `C:\Users\<Benutzername>\AppData\Local\Programs\bestandsconverter` und `C:\Users\<Benutzername>\AppData\Roaming\bestandsconverter` erweitert. Diese Speicherorte sind getrennt vom Ausgabeordner und den temporären Konvertierungsordnern.

## Verwendung

1. Fügen Sie Dateien über `Browse Files` oder einen Ordner über `Browse Folder` hinzu.
2. Dateien können auch in das Fenster gezogen werden.
3. Wählen Sie für jede Datei das Ausgabeformat und bei Bedarf die Auflösung.
4. Verwenden Sie bei mehreren Dateien die Sammelaktionen.
5. Wählen Sie `Convert All`.
6. Laden Sie die Ergebnisse einzeln oder als ZIP-Datei herunter.

Wenn in den Einstellungen ein Ausgabeordner festgelegt ist, werden einzelne Downloads und ZIP-Dateien automatisch dort gespeichert, ohne dass der Windows-Speicherdialog geöffnet wird. Ohne Ausgabeordner fragt Windows, wo jeder Download gespeichert werden soll.

### Verschlüsselter Tresor

Wählen Sie in den Einstellungen einen Ausgabeordner und aktivieren Sie `Ausgabeordner als Tresor festlegen`. Verwenden Sie ein Passwort mit mindestens 10 Zeichen und legen Sie ein Speicherlimit fest. Beim ZIP-Export können Sie anschließend zwischen Ausgabeordner und Tresor wählen.

Der Tresor speichert ZIP-Dateien als verschlüsselte `.fcpv`-Container in einem verborgenen `.fcp-vault`-Ordner. Inhalt und neue ZIP-Dateinamen werden mit AES-256-GCM geschützt; Argon2id leitet den Schlüssel aus dem Passwort ab. Windows Explorer kann die Container sehen, aber nicht lesen oder entschlüsseln. Mit `Tresor öffnen` können Sie Dateien auflisten, exportieren oder löschen.

Das Passwort wird nicht gespeichert. Ohne Passwort können verschlüsselte Dateien nicht wiederhergestellt werden. Das Entfernen des Ausgabeordners deaktiviert die Tresorkonfiguration, löscht aber keine vorhandenen Tresordaten. Das Speicherlimit begrenzt die Inhalte, reserviert jedoch keinen freien Speicherplatz in Windows Explorer.

### Audiotranskription

1. Fügen Sie eine WAV-, MP3-, M4A-, OGG- oder andere unterstützte Audiodatei hinzu.
2. Wählen Sie `TXT` für Text oder `SRT` für Untertitel.
3. Wählen Sie `Convert All` und warten Sie, bis die Transkription abgeschlossen ist.
4. Laden Sie das Transkript herunter.

Die Transkription läuft lokal mit Whisper, das im Installer enthalten ist. MSYS2, eine separate Whisper-Installation oder eine Internetverbindung ist nicht erforderlich. WAV-Dateien werden vor der Transkription automatisch normalisiert.

Konvertierungen können auch ohne Ausgabeordner ausgeführt werden. Quelldateien werden nur automatisch gelöscht, wenn ein Ausgabeordner festgelegt ist und die konvertierte Datei dort erfolgreich gespeichert wurde.

Für beste Ergebnisse sollten Sie eine gültige Quelldatei, ein geeignetes Ausgabeformat und eine passende Auflösung verwenden. Große Mediendateien können länger dauern.

## GPU-Beschleunigung

Beim Start prüft die App den installierten Grafikadapter. Wenn nur eine integrierte GPU erkannt wird, deaktiviert Electron die Hardwarebeschleunigung. Bei einer dedizierten GPU bleibt sie aktiviert. NVIDIA-GPUs können `h264_nvenc` und AMD-GPUs `h264_amf` für unterstützte Videoausgaben verwenden. Audio wird nativ über FFmpeg verarbeitet.

## Tastenkürzel

- `F11`: Vollbild ein- oder ausschalten

Die Electron-Menüleiste ist ausgeblendet. Die App startet im randlosen Vollbildmodus.

## Hintergrund festlegen

Klicken Sie auf der Startseite auf das Zahnradsymbol neben dem Hell-/Dunkel-Schalter. Wählen Sie `Hintergrund hinzufügen` oder `Hintergrund ändern` und wählen Sie ein Bild aus. Mit `Hintergrund ausschalten` kehren Sie zum Standardhintergrund zurück. Die Auswahl wird lokal in `config.json` gespeichert und bei jedem Start überprüft. Verwenden Sie ein Bild mit demselben Seitenverhältnis wie Ihr Bildschirm, da der Hintergrund sonst gestreckt werden kann.

## Erster Start

Beim ersten Start wählen Sie eine Sprache. Danach erscheint eine kurze Anleitung in dieser Sprache. Die Auswahl wird lokal gespeichert und die Anleitung wird nicht erneut angezeigt.

## Entwicklung

Voraussetzungen: Windows 10 oder neuer, Node.js 18 oder neuer und npm.

```powershell
npm install
npm rebuild ffmpeg-static --foreground-scripts
npm run dev
```

Weitere Befehle:

```powershell
npm run lint
npm run build
npm run dist
```

Der Installer wird unter `release/File Converter Pro Setup <Version>.exe` erstellt.

## Technologien

- React und React DOM: Benutzeroberfläche
- TypeScript und Vite: Entwicklung und Builds
- Electron: Desktop-Laufzeit
- electron-builder: Windows-Installer
- FFmpeg und `ffmpeg-static`: Video- und Audiokonvertierung
- PDF.js und jsPDF: PDF lesen und erstellen
- zip.js: ZIP-Dateien und AES-256-Verschlüsselung
- AES-256-GCM: Verschlüsselung der Tresorinhalte
- Argon2id: passwortbasierte Schlüsselableitung für den Tresor
- Node.js-crypto-APIs: sichere Dateiverarbeitung und Tresorfunktionen
- Tailwind CSS, PostCSS und Autoprefixer: Styling
- `concurrently`: Vite und Electron gemeinsam starten

## Technik und Datenschutz

Der Renderer verwendet `contextIsolation: true` und `nodeIntegration: false`. Native Funktionen werden über eine eingeschränkte Preload-IPC-API bereitgestellt. Die Konvertierung erfolgt lokal. Internet wird nur für die erste npm-Installation benötigt.

## Credits

**Ersteller / Autor:** B&B Coder  
**Projekt:** File Converter Pro (FCP)
