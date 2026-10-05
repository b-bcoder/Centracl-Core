# Schnellstart mit File Converter Pro

## Installation

1. Öffnen Sie den Ordner `release`.
2. Starten Sie den neuesten Installer, zum Beispiel `File Converter Pro Setup 1.0.2.exe`.
3. Folgen Sie den Windows-Installationsschritten.
4. Öffnen Sie File Converter Pro über das Startmenü oder die Verknüpfung.

Verwenden Sie die vollständige `.exe`-Datei. `.blockmap` und `.__uninstaller.exe` sind keine Installer.

## In 5 Schritten

1. Starten Sie `File Converter Pro`.
2. Klicken Sie auf `Browse Files` oder `Browse Folder`.
3. Wählen Sie das gewünschte Ausgabeformat.
4. Klicken Sie auf `Convert All`.
5. Klicken Sie auf `Download`, um das Ergebnis zu speichern.

Wenn in den Einstellungen ein Ausgabeordner festgelegt ist, werden Downloads automatisch dort gespeichert, ohne dass der Windows-Speicherdialog geöffnet wird. Ohne Ausgabeordner fragt Windows nach dem Speicherort. Die Konvertierung funktioniert auch ohne Ausgabeordner, Quelldateien werden dann jedoch nicht automatisch gelöscht.

## Verschlüsselter Tresor

1. Öffnen Sie die Einstellungen und wählen Sie einen Ausgabeordner.
2. Aktivieren Sie `Ausgabeordner als Tresor festlegen`.
3. Legen Sie ein Passwort mit mindestens 10 Zeichen und ein Speicherlimit fest.
4. Wählen Sie beim ZIP-Export den Tresor als Ziel.
5. Öffnen Sie den Tresor in den Einstellungen, um ZIP-Dateien zu exportieren oder zu löschen.

Tresordateien sind verschlüsselte `.fcpv`-Container. Windows Explorer kann ihren Inhalt nicht lesen. Das Passwort wird nicht gespeichert; ohne Passwort können die Dateien nicht wiederhergestellt werden.

Sie können Dateien auch in das Fenster ziehen.

## Audiotranskription

Fügen Sie eine Audiodatei hinzu, wählen Sie `TXT` für Text oder `SRT` für Untertitel und klicken Sie auf `Convert All`. Whisper ist im Installer enthalten und läuft lokal; MSYS2 oder eine Internetverbindung ist nicht erforderlich. WAV-Dateien werden automatisch normalisiert.

## Wichtig

Die App überprüft beim Start der Konvertierung, ob jede Quelldatei noch an ihrem ursprünglichen Ort verfügbar ist. Wenn eine Datei gelöscht, verschoben oder nicht mehr zugänglich ist, erscheint eine Fehlermeldung und die Konvertierung dieser Datei wird nicht fortgesetzt. Für die anderen Dateien geht die Konvertierung ganz normal weiter.

## Schnelle Tipps

- Verwenden Sie eine gültige, unbeschädigte Quelldatei.
- Wählen Sie eine passende Auflösung.
- Große Video- und Audiodateien können länger dauern.
- Mehrere Ergebnisse können gemeinsam als ZIP heruntergeladen werden.
- Drücken Sie `F11`, um den Vollbildmodus umzuschalten.

Die App verarbeitet Dateien lokal. Dateien werden nicht hochgeladen.

## Hintergrund

Klicken Sie auf das Zahnradsymbol neben dem Hell-/Dunkel-Schalter. Wählen Sie in den Einstellungen `Hintergrund hinzufügen` oder `Hintergrund ändern`. Mit `Hintergrund ausschalten` kehren Sie zum Standardhintergrund zurück. Verwenden Sie ein Bild mit demselben Seitenverhältnis wie Ihr Bildschirm, da der Hintergrund sonst gestreckt werden kann.
