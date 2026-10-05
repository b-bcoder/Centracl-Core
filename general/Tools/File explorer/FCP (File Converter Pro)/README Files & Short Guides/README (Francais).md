# File Converter Pro (FCP)

File Converter Pro est une application de bureau Windows qui convertit localement les fichiers image, vidéo, audio et PDF. Les fichiers ne sont pas envoyés vers un service en ligne.

## Créateur

**Auteur :** B&B Coder  
**Projet :** FCP (File Converter Pro)

## Fonctions

- Convertir les images en JPG, PNG, WEBP, HEIC, AVIF, PDF, ICO et SVG
- Convertir les vidéos en MP4, WEBM, WMV et MKV
- Convertir l'audio en MP3, WAV, FLAC et OGG
- Transcrire localement l'audio en TXT ou SRT avec Whisper
- Extraire le texte des fichiers PDF
- Combiner plusieurs images dans un seul PDF
- Traiter des fichiers et des dossiers par lots
- Modifier la résolution de sortie
- Définir un dossier de sortie pour les fichiers convertis et les téléchargements
- Transformer éventuellement le dossier de sortie en coffre chiffré
- Ouvrir, exporter et supprimer les ZIP du coffre depuis l'application
- Télécharger les résultats dans une archive ZIP
- Protéger une archive ZIP avec un mot de passe AES-256
- Protéger le contenu du coffre avec AES-256-GCM et Argon2id
- Interface multilingue et guide au premier démarrage
- Thèmes clair et sombre
- Arrière-plan réglable
- Plein écran sans bordure avec `F11`
- Détection du GPU dédié et FFmpeg natif dans Electron

## Configuration système

FCP est une application de bureau locale qui effectue les conversions et transcriptions directement sur votre ordinateur. Les tâches lourdes telles que les conversions par lots, le transcodage vidéo et la transcription Whisper peuvent consommer beaucoup de processeur, de mémoire RAM et d'espace disque temporaire.

### Minimum

- Windows 10 ou version ultérieure (64 bits)
- 8 Go de RAM
- Processeur 4 cœurs / 8 threads ou mieux
- SSD ou HDD avec suffisamment d'espace libre pour les fichiers temporaires et les résultats convertis
- GPU dédiée facultative, mais recommandée pour une conversion vidéo plus fluide

### Recommandé

- Windows 11 (64 bits)
- 16 Go de RAM ou plus
- Processeur 8 cœurs / 16 threads ou mieux, par exemple Ryzen 7/9 ou Intel i7/i9 récents
- SSD NVMe recommandée pour un traitement plus rapide des fichiers temporaires et des sorties
- GPU dédiée recommandée pour un traitement vidéo accéléré et une meilleure réactivité globale

> Remarque : une forte utilisation du processeur pendant la conversion est normale. FCP utilise FFmpeg natif et le moteur Whisper inclus localement, donc les processeurs multicœurs modernes peuvent être pleinement utilisés lors du traitement de fichiers multimédias volumineux ou de longues transcriptions audio.

## Installation

1. Ouvrez le dossier `release`.
2. Lancez le dernier installateur, par exemple `File Converter Pro Setup 1.0.2.exe`.
3. Suivez les étapes d'installation de Windows.
4. Lancez l'application depuis le menu Démarrer ou le raccourci.

Utilisez l'installateur `.exe` complet. Un fichier `.blockmap` et un fichier `.__uninstaller.exe` ne sont pas des installateurs.
Après l'installation, Windows crée un raccourci sur le bureau. L'application démarre automatiquement en plein écran sans bordure. Les fichiers installés se trouvent localement dans `%LOCALAPPDATA%\Programs\bestandsconverter`.

### Emplacements Windows

Après l'installation, FCP utilise les emplacements locaux suivants :

- Fichiers de mise à jour : `%LOCALAPPDATA%\bestandsconverter-updater`
- Fichiers de l'application installée : `%LOCALAPPDATA%\Programs\bestandsconverter`
- Paramètres et données utilisateur : `%APPDATA%\bestandsconverter`

Sur votre ordinateur, ces variables deviennent par exemple `C:\Users\<nom-utilisateur>\AppData\Local\bestandsconverter-updater`, `C:\Users\<nom-utilisateur>\AppData\Local\Programs\bestandsconverter` et `C:\Users\<nom-utilisateur>\AppData\Roaming\bestandsconverter`. Ces emplacements sont distincts du dossier de sortie et des dossiers temporaires de conversion.

## Utilisation

1. Ajoutez des fichiers avec `Browse Files` ou un dossier avec `Browse Folder`.
2. Vous pouvez également glisser les fichiers dans la fenêtre.
3. Sélectionnez le format de sortie et, si nécessaire, une résolution.
4. Utilisez les actions groupées pour plusieurs fichiers.
5. Sélectionnez `Convert All`.
6. Téléchargez les résultats séparément ou sous forme d'archive ZIP.

Lorsqu'un dossier de sortie est défini dans les paramètres, les téléchargements individuels et les archives ZIP y sont enregistrés automatiquement sans ouvrir la boîte de dialogue d'enregistrement de Windows. Sans dossier de sortie, Windows demande où enregistrer chaque téléchargement.

### Coffre chiffré

Dans les paramètres, choisissez un dossier de sortie et activez `Définir le dossier de sortie comme coffre`. Choisissez un mot de passe d'au moins 10 caractères et une limite de stockage. Lors de l'export ZIP, vous pouvez choisir entre le dossier de sortie normal et le coffre.

Le coffre stocke les ZIP comme conteneurs `.fcpv` chiffrés dans un dossier caché `.fcp-vault`. Le contenu et les nouveaux noms de fichiers ZIP sont protégés par AES-256-GCM ; Argon2id dérive la clé à partir du mot de passe. L'Explorateur Windows peut voir les conteneurs, mais ne peut pas les lire ni les déchiffrer. Utilisez `Ouvrir le coffre` pour lister, exporter ou supprimer les fichiers.

Le mot de passe n'est jamais enregistré. Sans lui, les fichiers chiffrés ne peuvent pas être récupérés. Supprimer le dossier de sortie désactive la configuration du coffre, mais ne supprime pas les données existantes. La limite contrôle le contenu du coffre sans réserver d'espace disque dans l'Explorateur Windows.

### Transcription audio

1. Ajoutez un fichier audio WAV, MP3, M4A, OGG ou autre format pris en charge.
2. Sélectionnez `TXT` pour du texte brut ou `SRT` pour des sous-titres.
3. Sélectionnez `Convert All` et attendez la fin de la transcription.
4. Téléchargez la transcription générée.

La transcription fonctionne localement avec Whisper, inclus dans l'installateur. MSYS2, une installation séparée de Whisper ou une connexion Internet ne sont pas nécessaires. Les fichiers WAV sont automatiquement normalisés avant la transcription.

Les conversions peuvent être effectuées sans dossier de sortie. Les fichiers source ne sont supprimés automatiquement que lorsqu'un dossier de sortie est défini et que le fichier converti y a été enregistré avec succès.

Pour un meilleur résultat, utilisez un fichier source valide, un format adapté et une résolution appropriée. Les fichiers multimédias volumineux peuvent prendre plus de temps.

## Accélération GPU

L'application vérifie l'adaptateur vidéo au démarrage. Si seul un GPU intégré est détecté, l'accélération matérielle d'Electron est désactivée. Avec un GPU dédié, elle reste active. Les GPU NVIDIA peuvent utiliser `h264_nvenc` et les GPU AMD `h264_amf` pour les sorties vidéo compatibles. L'audio est traité nativement par FFmpeg.

## Raccourci

- `F11` : activer ou désactiver le plein écran

La barre de menus Electron est masquée. L'application démarre en plein écran sans bordure.

## Définir un arrière-plan

Cliquez sur l’icône d’engrenage à côté du bouton clair/sombre sur la page d’accueil. Choisissez `Ajouter un arrière-plan` ou `Modifier l’arrière-plan`, puis sélectionnez une image. Choisissez `Désactiver l’arrière-plan` pour revenir à l’arrière-plan par défaut. Le choix est enregistré localement dans `config.json` et vérifié à chaque démarrage. Utilisez une image avec le même rapport d’aspect que votre écran, sinon l’arrière-plan peut être étiré.

## Premier démarrage

Au premier lancement, choisissez une langue. Un court guide apparaît ensuite dans cette langue. Le choix est enregistré localement et le guide ne réapparaît pas.

## Développement

Prérequis : Windows 10 ou version ultérieure, Node.js 18 ou version ultérieure et npm.

```powershell
npm install
npm rebuild ffmpeg-static --foreground-scripts
npm run dev
```

Autres commandes :

```powershell
npm run lint
npm run build
npm run dist
```

L'installateur est créé dans `release/File Converter Pro Setup <version>.exe`.

## Technologies

- React et React DOM : interface utilisateur
- TypeScript et Vite : développement et builds
- Electron : environnement de bureau
- electron-builder : installateur Windows
- FFmpeg et `ffmpeg-static` : conversion vidéo et audio
- PDF.js et jsPDF : lecture et création de PDF
- zip.js : archives ZIP et chiffrement AES-256
- AES-256-GCM : chiffrement du contenu du coffre
- Argon2id : dérivation de clé basée sur le mot de passe pour le coffre
- APIs crypto Node.js : traitement sécurisé des fichiers et du coffre
- Tailwind CSS, PostCSS et Autoprefixer : styles
- `concurrently` : lancer Vite et Electron ensemble

## Technologie et confidentialité

Le renderer utilise `contextIsolation: true` et `nodeIntegration: false`. Les fonctions natives passent par une API IPC limitée dans preload. Les conversions sont réalisées localement. Internet est uniquement nécessaire lors de la première installation npm.

## Crédits

**Créateur / Auteur :** B&B Coder  
**Projet :** File Converter Pro (FCP)
