# Güvenlik

## Açık bildirme

Bir güvenlik açığı bulduysanız lütfen **herkese açık issue açmayın**. GitHub'ın
"Report a vulnerability" (Security → Advisories) özelliğiyle özel olarak bildirin.

## Gizli bilgiler

- Cloudflare API token'ı ve hesap bilgileri **yalnızca** ortam değişkenlerinde veya git'e girmeyen `.env`
  dosyasında tutulur (`.gitignore`). Depoda yalnızca boş `.env.example` bulunur.
- `wrangler.jsonc` içindeki `database_id` gizli değildir: veritabanına erişim için hesabın API token'ı gerekir.
  Fork'lar `npm run setup:cloudflare` çalıştırdığında kendi veritabanlarının kimliği otomatik yazılır.
- CI iş akışı hiçbir secret kullanmaz ve deploy yapmaz.
- `AUTH_PEPPER` Worker secret'ı `npm run setup:cloudflare` tarafından yalnızca yoksa rastgele üretilir ve hiçbir yerde gösterilmez. **Değiştirilirse mevcut tüm şifreler geçersiz olur.** Yerel geliştirme için `.dev.vars` (git'e girmez) kullanılır.

## Uygulama güvenlik modeli (MVP)

| Konu | Önlem |
|---|---|
| Kimlik | **Hesaplı aileler:** kullanıcı adı + şifre (e-posta yok). Şifreler PBKDF2-SHA256 (60.000 yineleme; Workers Free CPU sınırına göre ölçülerek seçildi), 16 bayt tuz ve Worker secret'ında duran gizli bir pepper ile özetlenir; veritabanı sızsa bile pepper olmadan çevrimdışı deneme yapılamaz. Girişte 256 bit rastgele oturum token'ı üretilir, veritabanında yalnızca SHA-256 özeti tutulur (180 gün). Şifre değişince diğer oturumlar kapanır. Giriş denemeleri IP ve kullanıcı adı başına sınırlıdır (10 dk'da 10); kullanıcı yoksa da aynı hesaplama yapılır ve aynı hata döner. **Hesapsız aileler:** cihazda saklanan tahmin edilemeyen UUID (`X-Parent-Id`); kullanıcı adı belirlenince bu kimlik geçersizleşir. Çocuğa ait her uç nokta sahipliği doğrular (`403`). |
| Skorlama | WPM ve anlama skoru yalnızca backend'de hesaplanır; doğru cevaplar istemciye gönderilmez; süreler oturum süresi ve 350 WPM ile sınırlandırılır. Oyun sonuçları istemcide hesaplanır, sunucu yalnızca makul aralıkları doğrular. |
| Girdi | Tüm girdiler Zod ile doğrulanır; tüm SQL sorguları parametrelidir; istek gövdesi 16 KB ile sınırlıdır. |
| XSS / Clickjacking | React çıktıyı kaçışlar; sıkı CSP (`script-src 'self'`, satır içi betik yok), `frame-ancestors 'none'`, `nosniff` (bkz. `public/_headers`). |
| CSRF | Kimlik özel bir başlıkla taşınır (çerez yok); yazma isteklerinde `Origin` kontrol edilir; CORS başlığı verilmez. |
| Kötüye kullanım | Worker içinde IP başına hız sınırı (dakikada 240 istek / 60 yazma, saatte 30 yeni kayıt). Bellek içi ve "en iyi çaba" düzeyindedir; Free plan hesabında aşım faturaya değil yalnızca geçici kesintiye yol açar. Özel alan adında Cloudflare WAF hız sınırı kuralı eklenmesi önerilir. |
| Eşzamanlılık | Aynı oturumu iki kez bitirme/cevaplama XP'yi iki kez eklemez (koşullu güncelleme + `UNIQUE` kısıtları). |
| Gizlilik | Yalnızca ebeveyn adı, isteğe bağlı kullanıcı adı ve şifre özeti, çocuğun adı, isteğe bağlı sınıfı ve doğum yılı ile okuma istatistikleri saklanır. E-posta, ses kaydı, fotoğraf toplanmaz. Fontlar uygulamayla birlikte sunulur; üçüncü taraf istek (Google Fonts, analitik, reklam) yoktur. Service worker API yanıtlarını önbelleğe almaz. |
| Mahalle sıralaması | Yalnızca giriş yapmış kullanıcılar görebilir (herkese açık değil). Yanıtta yalnızca çocuğun adı (ilk kelime), avatarı ve dönem XP'si bulunur; soyad, kimlik, ebeveyn bilgisi gönderilmez. Yalnızca kullanıcı adı/şifresi olan hesaplar listelenir; ebeveyn "Mahalle sıralamasında görünsün" ayarını kapatabilir. |
| Hata mesajları | İstemciye genel mesaj döner; ayrıntılar yalnızca Worker loglarına yazılır. |

## Bağımlılıklar

Dependabot haftalık güncelleme PR'ları açar; CI `npm audit --audit-level=high` çalıştırır.
