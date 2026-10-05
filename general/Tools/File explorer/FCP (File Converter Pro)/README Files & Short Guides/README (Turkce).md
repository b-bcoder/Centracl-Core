# File Converter Pro (FCP)

File Converter Pro, görüntüleri, videoları, ses dosyalarını ve PDF dosyalarını hızlı ve yerel olarak dönüştürmek için bir Windows masaüstü uygulamasıdır. Dosyalar çevrim içi bir servise yüklenmez.

## Geliştirici

**Yazar:** B&B Coder  
**Proje:** FCP (File Converter Pro)

## Özellikler

- Görüntüleri JPG, PNG, WEBP, HEIC, AVIF, PDF, ICO ve SVG formatlarına dönüştürme
- Videoları MP4, WEBM, WMV ve MKV formatlarına dönüştürme
- Ses dosyalarını MP3, WAV, FLAC ve OGG formatlarına dönüştürme
- Ses dosyalarını Whisper ile yerel olarak TXT veya SRT formatına dönüştürme
- PDF dosyalarından metin çıkarma
- Birden fazla görüntüyü tek PDF dosyasında birleştirme
- Dosya ve klasörleri toplu işleme
- Çıkış çözünürlüğünü değiştirme
- Dönüştürülen dosyalar ve indirmeler için çıkış klasörü belirleme
- Çıkış klasörünü isteğe bağlı olarak şifreli kasaya dönüştürme
- Kasa ZIP dosyalarını uygulama içinden açma, dışa aktarma ve silme
- Sonuçları ZIP olarak indirme
- ZIP dosyalarını AES-256 parolasıyla koruma
- Kasa içeriğini AES-256-GCM ve Argon2id ile koruma
- Çok dilli arayüz ve ilk açılış kılavuzu
- Açık ve koyu tema
- Ayarlanabilir arka plan
- `F11` ile kenarlıksız tam ekran
- Özel GPU algılama ve Electron içinde yerel FFmpeg

## Sistem gereksinimleri

FCP, dönüştürme ve transkripsiyon işlemlerini doğrudan bilgisayarınızda çalışan yerel bir masaüstü uygulamasıdır. Toplu dönüştürme, video dönüştürme ve Whisper transkripsiyonu gibi ağır işlemler yüksek CPU, RAM ve geçici depolama alanı kullanabilir.

### Minimum

- Windows 10 veya üzeri (64-bit)
- 8 GB RAM
- 4 çekirdek / 8 iş parçacıklı CPU veya daha iyi
- Geçici dosyalar ve dönüştürülen çıktı için yeterli boş alan sağlayan SSD veya HDD
- Özel GPU isteğe bağlıdır, ancak daha akıcı video dönüştürme için önerilir

### Önerilen

- Windows 11 (64-bit)
- 16 GB RAM veya daha fazla
- 8 çekirdek / 16 iş parçacıklı CPU veya daha iyi; örneğin modern Ryzen 7/9 veya Intel i7/i9
- Geçici dosya işleme ve çıktı için NVMe SSD tercih edilir
- Hızlandırılmış video işleme ve daha iyi genel yanıt süresi için özel GPU önerilir

> Not: dönüştürme sırasında yüksek CPU kullanımı normaldir. FCP yerel olarak native FFmpeg ve birlikte gelen Whisper motorunu kullanır; bu yüzden modern çok çekirdekli CPU'lar büyük medya dosyaları veya uzun ses transkripsiyonları işlenirken tam kapasiteyle kullanılabilir.

## Kurulum

1. `release` klasörünü açın.
2. En güncel yükleyiciyi, örneğin `File Converter Pro Setup 1.0.2.exe` dosyasını çalıştırın.
3. Windows kurulum adımlarını izleyin.
4. Uygulamayı Başlat menüsünden veya kısayoldan açın.

Tam `.exe` yükleyicisini kullanın. `.blockmap` ve `.__uninstaller.exe` dosyaları yükleyici değildir.
Kurulumdan sonra Windows masaüstünde bir kısayol oluşturur. Uygulama varsayılan olarak kenarlıksız tam ekran modunda otomatik olarak başlar. Yüklü dosyalar yerel olarak `%LOCALAPPDATA%\Programs\bestandsconverter` konumunda bulunur.

### Windows dosya konumları

Kurulumdan sonra FCP şu yerel konumları kullanır:

- Güncelleme dosyaları: `%LOCALAPPDATA%\bestandsconverter-updater`
- Yüklü uygulama dosyaları: `%LOCALAPPDATA%\Programs\bestandsconverter`
- Ayarlar ve kullanıcı verileri: `%APPDATA%\bestandsconverter`

Bilgisayarınızda bu değişkenler örneğin `C:\Users\<kullanıcı-adı>\AppData\Local\bestandsconverter-updater`, `C:\Users\<kullanıcı-adı>\AppData\Local\Programs\bestandsconverter` ve `C:\Users\<kullanıcı-adı>\AppData\Roaming\bestandsconverter` olarak açılır. Bu konumlar seçilen çıktı klasöründen ve geçici dönüştürme klasörlerinden ayrıdır.

## Kullanım

1. `Browse Files` ile dosya veya `Browse Folder` ile klasör ekleyin.
2. Dosyaları pencereye sürükleyebilirsiniz.
3. Her dosya için çıkış formatını ve gerekirse çözünürlüğü seçin.
4. Birden fazla dosya için toplu işlemleri kullanın.
5. `Convert All` seçeneğine tıklayın.
6. Sonuçları ayrı ayrı veya ZIP olarak indirin.

Ayarlar bölümünde bir çıkış klasörü belirlendiğinde, tek tek indirmeler ve ZIP dosyaları Windows kaydetme penceresi açılmadan otomatik olarak bu klasöre kaydedilir. Çıkış klasörü belirlenmezse Windows her indirmenin nereye kaydedileceğini sorar.

### Şifreli kasa

Ayarlar bölümünde bir çıkış klasörü seçin ve `Çıkış klasörünü kasa olarak ayarla` seçeneğini etkinleştirin. En az 10 karakterlik bir parola ve depolama kotası belirleyin. ZIP dışa aktarımı sırasında normal çıkış klasörü ile kasa arasında seçim yapabilirsiniz.

Kasa, ZIP dosyalarını gizli `.fcp-vault` klasöründe şifreli `.fcpv` kapsayıcıları olarak saklar. İçerik ve yeni ZIP dosya adları AES-256-GCM ile korunur; Argon2id şifreleme anahtarını paroladan türetir. Windows Gezgini kapsayıcıları görebilir ancak okuyamaz veya çözemez. Dosyaları listelemek, dışa aktarmak veya silmek için Ayarlar bölümündeki `Kasayı aç` seçeneğini kullanın.

Parola kaydedilmez. Parola olmadan şifreli dosyalar kurtarılamaz. Çıkış klasörünü kaldırmak kasa yapılandırmasını devre dışı bırakır, mevcut kasa verilerini silmez. Kota içerik miktarını sınırlar ancak Windows Gezgini'nde disk alanı ayırmaz.

### Ses transkripsiyonu

1. WAV, MP3, M4A, OGG veya desteklenen başka bir ses dosyası ekleyin.
2. Düz metin için `TXT`, altyazı için `SRT` seçin.
3. `Convert All` seçeneğine tıklayın ve transkripsiyonun tamamlanmasını bekleyin.
4. Oluşturulan metni indirin.

Transkripsiyon, yükleyiciye dahil edilen Whisper ile yerel olarak çalışır. MSYS2, ayrı bir Whisper kurulumu veya internet bağlantısı gerekmez. WAV dosyaları transkripsiyondan önce otomatik olarak normalleştirilir.

Dönüştürme işlemleri çıkış klasörü olmadan da çalışabilir. Kaynak dosyalar yalnızca bir çıkış klasörü belirlendiğinde ve dönüştürülen dosya buraya başarıyla kaydedildiğinde otomatik olarak silinir.

En iyi sonuç için geçerli bir kaynak dosyası, uygun bir çıkış formatı ve doğru çözünürlük kullanın. Büyük medya dosyalarının işlenmesi daha uzun sürebilir.

## GPU hızlandırma

Uygulama başlangıçta video adaptörünü kontrol eder. Yalnızca tümleşik GPU algılanırsa Electron donanım hızlandırmasını kapatır. Özel GPU bulunduğunda hızlandırma açık kalır. Desteklenen video çıkışlarında NVIDIA GPU'lar `h264_nvenc`, AMD GPU'lar `h264_amf` kullanabilir. Ses yerel FFmpeg üzerinden işlenir.

## Kısayollar

- `F11`: tam ekranı aç veya kapat

Electron menü çubuğu gizlidir. Uygulama kenarlıksız tam ekran modunda başlar.

## İlk açılış

İlk açılışta bir dil seçin. Ardından kısa kullanım kılavuzu seçilen dilde gösterilir. Seçim yerel olarak kaydedilir ve kılavuz tekrar gösterilmez.

## Geliştirme

Gereksinimler: Windows 10 veya üzeri, Node.js 18 veya üzeri ve npm.

```powershell
npm install
npm rebuild ffmpeg-static --foreground-scripts
npm run dev
```

Diğer komutlar:

```powershell
npm run lint
npm run build
npm run dist
```

Yükleyici `release/File Converter Pro Setup <sürüm>.exe` konumunda oluşturulur.

## Teknolojiler

- React ve React DOM: kullanıcı arayüzü
- TypeScript ve Vite: geliştirme ve derleme
- Electron: masaüstü çalışma ortamı
- electron-builder: Windows yükleyicisi
- FFmpeg ve `ffmpeg-static`: video ve ses dönüştürme
- PDF.js ve jsPDF: PDF okuma ve oluşturma
- zip.js: ZIP ve AES-256 şifreleme
- AES-256-GCM: kasa içeriği şifreleme
- Argon2id: kasa için parola tabanlı anahtar türetme
- Node.js crypto API'leri: güvenli dosya ve kasa işleme
- Tailwind CSS, PostCSS ve Autoprefixer: stil
- `concurrently`: Vite ve Electron'u birlikte başlatma

## Teknoloji ve gizlilik

Renderer `contextIsolation: true` ve `nodeIntegration: false` kullanır. Yerel işlevler sınırlı preload IPC API üzerinden sunulur. Dönüştürme işlemleri yerel olarak yapılır. İnternet yalnızca ilk npm kurulumu sırasında gereklidir.

## Arka plan ayarlama

Ana sayfada açık/koyu tema düğmesinin yanındaki dişli simgesine tıklayın. `Arka plan ekle` veya `Arka planı değiştir` seçeneklerinden birini seçip bir görüntü belirleyin. Varsayılan arka plana dönmek için `Arka planı kapat` seçeneğini kullanın. Seçim yerel olarak `config.json` dosyasına kaydedilir. Görüntünün esnememesi için ekranınızla aynı en-boy oranına sahip bir görsel kullanın.

## Katkı ve teşekkürler

**Geliştirici / Yazar:** B&B Coder  
**Proje:** File Converter Pro (FCP)
