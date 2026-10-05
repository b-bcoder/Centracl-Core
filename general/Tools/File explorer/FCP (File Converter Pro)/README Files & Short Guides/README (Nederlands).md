# File Converter Pro (FCP)

File Converter Pro is een Windows-desktopapp waarmee je afbeeldingen, video, audio, Office-documenten, PDF-bestanden en 3D-modellen lokaal converteert en gangbare archieven uitpakt. Bestanden worden niet geüpload naar een online dienst.

## Maker

**Author:** B&B Coder  
**Project:** FCP (File Converter Pro)

## Functies

- Afbeeldingen converteren naar JPG, PNG, WEBP, HEIC, AVIF, PDF, ICO en SVG
- Video converteren naar MP4, WEBM, WMV en MKV
- Audio converteren naar MP3, WAV, FLAC en OGG
- Audio lokaal transcriberen naar TXT of SRT met Whisper
- PDF-bestanden naar tekst converteren
- DOCX-documenten naar TXT, HTML of PDF converteren
- XLSX-werkmappen naar CSV (alleen het eerste werkblad), JSON, TXT of PDF converteren
- ZIP-, 7Z-, TAR-, GZ/TGZ-, BZ2/TBZ-, XZ/TXZ-, LZMA- en CAB-archieven uitpakken
- Meerdere afbeeldingen combineren tot één PDF
- Bestanden en mappen tegelijk verwerken
- Resolutie aanpassen
- Een uitvoermap instellen voor geconverteerde bestanden en downloads
- De uitvoermap optioneel instellen als versleutelde kluis
- Kluis-ZIP-bestanden vanuit de app openen, exporteren en verwijderen
- Resultaten als ZIP downloaden
- ZIP beveiligen met AES-256-wachtwoord
- Kluisinhoud beveiligen met AES-256-GCM en Argon2id
- Meertalige interface en eerste-start uitleg
- Donkere en lichte weergave
- Instelbare achtergrond
- Borderless fullscreen met `F11`
- Dedicated-GPU-detectie en native FFmpeg in Electron

DOCX wordt als platte tekst, eenvoudige HTML of tekst-PDF uitgevoerd. XLSX behoudt werkbladnamen en celtekst; CSV bevat alleen het eerste werkblad. XLSX-conversies zijn beperkt tot 1.000.000 cellen. Archieven worden uitgepakt in een nieuwe submap. Archieven met onveilige paden of links, meer dan 50.000 items, een lijst groter dan 4 MB of meer dan 100 GB uitgepakte data worden geweigerd.

## Systeemvereisten

FCP is een lokale desktopapp die conversies en transcripten direct op je computer uitvoert. Zware taken zoals batchconversies, video-transcoding en Whisper-transcriptie kunnen veel CPU, RAM en tijdelijk opslagruimte gebruiken.

### Minimum

- Windows 10 of nieuwer (64-bit)
- 8 GB RAM
- 4-core / 8-thread CPU of beter
- SSD of HDD met voldoende vrije ruimte voor tijdelijke bestanden en geconverteerde output
- Dedicated GPU optioneel, maar aanbevolen voor soepelere videoconversie

### Aanbevolen

- Windows 11 (64-bit)
- 16 GB RAM of meer
- 8-core / 16-thread CPU of beter, zoals een moderne Ryzen 7/9 of Intel i7/i9
- NVMe SSD aanbevolen voor snellere verwerking van tijdelijke bestanden en output
- Dedicated GPU aanbevolen voor versnelde videobewerking en betere algehele responsiviteit

> Opmerking: hoge CPU-belasting tijdens het converteren is normaal. FCP gebruikt native FFmpeg en de meegeleverde Whisper-engine lokaal, waardoor moderne multi-core CPUs volledig kunnen worden benut bij grote mediabestanden of lange audiotranscripties.

## Installeren

1. Open de map `release`.
2. Start de nieuwste installer, bijvoorbeeld `File Converter Pro Setup 1.0.2.exe`.
3. Volg de Windows-installatiestappen.
4. Start de app via het Startmenu of de snelkoppeling.

Gebruik de volledige `.exe`. Een `.blockmap` en `.__uninstaller.exe` zijn geen installatiebestanden.
Na de installatie maakt Windows een snelkoppeling op het bureaublad aan. De app start standaard automatisch in borderless fullscreen. De geïnstalleerde bestanden staan lokaal in `%LOCALAPPDATA%\Programs\bestandsconverter`.

### Windows-bestandslocaties

FCP gebruikt na installatie de volgende locaties:

- Updatebestanden: `%LOCALAPPDATA%\bestandsconverter-updater`
- Geïnstalleerde programmabestanden: `%LOCALAPPDATA%\Programs\bestandsconverter`
- Instellingen en gebruikersgegevens: `%APPDATA%\bestandsconverter`

Op jouw computer worden deze omgevingsvariabelen bijvoorbeeld uitgevouwen naar `C:\Users\<gebruikersnaam>\AppData\Local\bestandsconverter-updater`, `C:\Users\<gebruikersnaam>\AppData\Local\Programs\bestandsconverter` en `C:\Users\<gebruikersnaam>\AppData\Roaming\bestandsconverter`. Dit staat los van de uitvoermap en de tijdelijke conversiemappen.

## Gebruiken

1. Voeg bestanden toe met `Browse Files` of een map met `Browse Folder`.
2. Je kunt bestanden ook naar het venster slepen.
3. Kies per bestand het uitvoerformaat en eventueel een resolutie.
4. Gebruik bij meerdere bestanden de bulkacties.
5. Kies `Convert All`.
6. Download de resultaten afzonderlijk of als ZIP.

Als je in de instellingen een uitvoermap instelt, worden losse downloads en ZIP-bestanden daar automatisch opgeslagen zonder dat Windows Verkenner opent. Zonder uitvoermap vraagt Windows waar elk downloadbestand moet worden opgeslagen.

### Versleutelde kluis

Kies in de instellingen een uitvoermap en vink `Doelpad instellen als kluis` aan. Kies een wachtwoord van minimaal 10 tekens en een opslagquota. Bij ZIP-export kun je daarna kiezen tussen de normale uitvoermap en de kluis.

De kluis bewaart ZIP-bestanden als versleutelde `.fcpv`-containers in een verborgen map `.fcp-vault`. De inhoud en nieuwe ZIP-bestandsnamen worden beveiligd met AES-256-GCM; Argon2id leidt de encryptiesleutel af uit het wachtwoord. Windows Verkenner kan de containers wel zien, maar niet lezen of ontsleutelen. Gebruik `Kluis openen` in de instellingen om bestanden te bekijken, te exporteren of te verwijderen.

Het wachtwoord wordt nooit opgeslagen. Zonder wachtwoord kunnen versleutelde bestanden niet worden hersteld. Het verwijderen van de uitvoermap schakelt de kluisconfiguratie uit, maar verwijdert bestaande kluisdata niet. De quota beperkt de opgeslagen data en reserveert geen vrije schijfruimte in Windows Verkenner.

### Audio transcriberen

1. Voeg een WAV-, MP3-, M4A-, OGG- of ander ondersteund audiobestand toe.
2. Kies `TXT` voor gewone tekst of `SRT` voor ondertitels.
3. Kies `Convert All` en wacht tot de transcriptie klaar is.
4. Download het transcript.

De transcriptie draait lokaal met Whisper, dat in de installer is meegeleverd. MSYS2, een aparte Whisper-installatie of internet is niet nodig. WAV-bestanden worden automatisch genormaliseerd voordat ze worden getranscribeerd.

Converteren zonder uitvoermap is toegestaan. Bronbestanden worden alleen automatisch verwijderd als een uitvoermap is ingesteld en het geconverteerde bestand daar succesvol is opgeslagen.

Gebruik voor de beste kwaliteit een niet-beschadigd bronbestand, een passend formaat en een geschikte resolutie. Grote mediabestanden kunnen langer duren.

## GPU-acceleratie

De app controleert bij het opstarten de videokaart. Bij alleen een geïntegreerde GPU wordt Electron-hardwareacceleratie uitgeschakeld. Bij een dedicated GPU blijft deze ingeschakeld. NVIDIA kan `h264_nvenc` gebruiken en AMD `h264_amf` voor bepaalde video-uitvoerformaten. Audio blijft native via FFmpeg verwerken.

## Sneltoetsen

- `F11`: fullscreen aan of uit

De Electron-menubalk is verborgen. De app start standaard borderless fullscreen.

## Achtergrond instellen

Klik op het tandwiel naast de light/dark-toggle op de homepagina. Kies `Achtergrond toevoegen` of `Achtergrond wijzigen` en selecteer een afbeelding of MP4/WebM-video. Video's worden gedempt en herhaald afgespeeld. Kies `Achtergrond uitzetten` om terug te keren naar de standaardachtergrond. De keuze wordt lokaal opgeslagen en bij iedere start geladen.

## Eerste start

Bij de eerste start kiest de gebruiker een taal. Daarna verschijnt een korte uitleg in de gekozen taal. De keuze wordt lokaal opgeslagen en de onboarding verschijnt niet opnieuw.

## Development

Vereist: Windows 10 of nieuwer, Node.js 18 of nieuwer en npm.

```powershell
npm install
npm rebuild ffmpeg-static --foreground-scripts
npm run dev
```

Andere commando's:

```powershell
npm run lint
npm run build
npm run dist
```

De installer wordt gemaakt in `release/File Converter Pro Setup <versie>.exe`.

## Technologieën

- React en React DOM: gebruikersinterface
- TypeScript en Vite: development en build
- Electron: desktopruntime
- electron-builder: Windows-installer
- FFmpeg en `ffmpeg-static`: video- en audioconversie
- PDF.js en jsPDF: PDF lezen en maken
- zip.js: ZIP en AES-256
- AES-256-GCM: versleuteling van kluisinhoud
- Argon2id: wachtwoordgebaseerde sleutelafleiding voor de kluis
- Node.js crypto APIs: veilige verwerking van bestanden en kluisdata
- Tailwind CSS, PostCSS en Autoprefixer: styling
- `concurrently`: Vite en Electron tegelijk starten

## Techniek en privacy

De renderer gebruikt `contextIsolation: true` en `nodeIntegration: false`. Native functies lopen via de beperkte preload-IPC-API. Conversies worden lokaal uitgevoerd. Internet is alleen nodig voor de eerste npm-installatie.

## Credits

**Maker / Author:** B&B Coder  
**Project:** File Converter Pro (FCP)
