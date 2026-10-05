# Démarrage rapide avec File Converter Pro

## Installation

1. Ouvrez le dossier `release`.
2. Lancez le dernier installateur, par exemple `File Converter Pro Setup 1.0.2.exe`.
3. Suivez les étapes d'installation de Windows.
4. Ouvrez File Converter Pro depuis le menu Démarrer ou le raccourci.

Utilisez l'installateur `.exe` complet. Les fichiers `.blockmap` et `.__uninstaller.exe` ne sont pas des installateurs.

## En 5 étapes

1. Lancez `File Converter Pro`.
2. Cliquez sur `Browse Files` ou `Browse Folder`.
3. Choisissez le format de sortie souhaité.
4. Cliquez sur `Convert All`.
5. Cliquez sur `Download` pour enregistrer le résultat.

Lorsqu'un dossier de sortie est défini dans les paramètres, les téléchargements y sont enregistrés automatiquement sans ouvrir la boîte de dialogue d'enregistrement de Windows. Sans dossier de sortie, Windows demande l'emplacement d'enregistrement. La conversion reste possible sans dossier de sortie, mais les fichiers source ne sont pas supprimés automatiquement.

## Coffre chiffré

1. Ouvrez les paramètres et choisissez un dossier de sortie.
2. Activez `Définir le dossier de sortie comme coffre`.
3. Choisissez un mot de passe d'au moins 10 caractères et une limite de stockage.
4. Lors de l'export ZIP, choisissez le coffre comme destination.
5. Ouvrez le coffre dans les paramètres pour exporter ou supprimer les ZIP.

Les fichiers du coffre sont des conteneurs `.fcpv` chiffrés. L'Explorateur Windows ne peut pas lire leur contenu. Le mot de passe n'est pas enregistré ; sans lui, les fichiers ne peuvent pas être récupérés.

Vous pouvez également glisser les fichiers dans la fenêtre.

## Transcription audio

Ajoutez un fichier audio, sélectionnez `TXT` pour du texte ou `SRT` pour des sous-titres, puis cliquez sur `Convert All`. Whisper est inclus dans l'installateur et fonctionne localement ; MSYS2 ou une connexion Internet ne sont pas nécessaires. Les fichiers WAV sont automatiquement normalisés.

## Important

L'application vérifie au démarrage de la conversion si chaque fichier source est toujours disponible à son emplacement d'origine. Si un fichier a été supprimé, déplacé ou n'est plus accessible, un message d'erreur apparaît et la conversion de ce fichier ne continue pas. Pour les autres fichiers, la conversion se poursuit normalement.

## Conseils rapides

- Utilisez un fichier source valide et non endommagé.
- Choisissez une résolution adaptée au résultat souhaité.
- Les fichiers vidéo et audio volumineux peuvent prendre plus de temps.
- Téléchargez plusieurs résultats ensemble dans une archive ZIP.
- Appuyez sur `F11` pour activer ou désactiver le plein écran.

L'application traite les fichiers localement. Les fichiers ne sont pas téléversés.

## Arrière-plan

Cliquez sur l’icône d’engrenage à côté du bouton clair/sombre. Dans les paramètres, choisissez `Ajouter un arrière-plan` ou `Modifier l’arrière-plan`. Choisissez `Désactiver l’arrière-plan` pour revenir à l’arrière-plan par défaut. Utilisez une image avec le même rapport d’aspect que votre écran, sinon l’arrière-plan peut être étiré.
