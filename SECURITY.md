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

## Uygulama güvenlik modeli (MVP)

| Konu | Önlem |
|---|---|
| Kimlik | Şifre yoktur. Ebeveyn kimliği tahmin edilemeyen bir UUID'dir (122 bit rastgelelik), tarayıcıda saklanır ve `X-Parent-Id` başlığıyla gönderilir. Çocuğa ait her uç nokta sahipliği doğrular (`403`). Bu bir taşıyıcı (bearer) anahtardır: cihaza erişimi olan kişi verilere de erişir. Gerçek kimlik doğrulama için yer hazırdır (`worker/index.ts`, `worker/lib/access.ts`). |
| Skorlama | WPM ve anlama skoru yalnızca backend'de hesaplanır; doğru cevaplar istemciye gönderilmez; süreler oturum süresi ve 350 WPM ile sınırlandırılır. Oyun sonuçları istemcide hesaplanır, sunucu yalnızca makul aralıkları doğrular. |
| Girdi | Tüm girdiler Zod ile doğrulanır; tüm SQL sorguları parametrelidir; istek gövdesi 16 KB ile sınırlıdır. |
| XSS / Clickjacking | React çıktıyı kaçışlar; sıkı CSP (`script-src 'self'`, satır içi betik yok), `frame-ancestors 'none'`, `nosniff` (bkz. `public/_headers`). |
| CSRF | Kimlik özel bir başlıkla taşınır (çerez yok); yazma isteklerinde `Origin` kontrol edilir; CORS başlığı verilmez. |
| Kötüye kullanım | Worker içinde IP başına hız sınırı (dakikada 240 istek / 60 yazma, saatte 30 yeni kayıt). Bellek içi ve "en iyi çaba" düzeyindedir; Free plan hesabında aşım faturaya değil yalnızca geçici kesintiye yol açar. Özel alan adında Cloudflare WAF hız sınırı kuralı eklenmesi önerilir. |
| Eşzamanlılık | Aynı oturumu iki kez bitirme/cevaplama XP'yi iki kez eklemez (koşullu güncelleme + `UNIQUE` kısıtları). |
| Gizlilik | Yalnızca çocuğun adı, isteğe bağlı sınıfı ve doğum yılı ile okuma istatistikleri saklanır. E-posta, şifre, ses kaydı, fotoğraf toplanmaz. Fontlar uygulamayla birlikte sunulur; üçüncü taraf istek (Google Fonts, analitik, reklam) yoktur. Service worker API yanıtlarını önbelleğe almaz. |
| Hata mesajları | İstemciye genel mesaj döner; ayrıntılar yalnızca Worker loglarına yazılır. |

## Bağımlılıklar

Dependabot haftalık güncelleme PR'ları açar; CI `npm audit --audit-level=high` çalıştırır.
