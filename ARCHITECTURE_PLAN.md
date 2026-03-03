# Mimari Analiz ve Yeniden Yapilandirma Plani

## Mevcut Durum (Problemler)

### 1. Frontend (Next.js)
- **Monolitik Yapi**: Tum sayfalar tek bir context'ten (`FirebaseDataContext`) besleniyor
- **Buyuk Bundle Boyutu**: Butun modaller, componentler ve sayfalar birlikte yukleniyor
- **Bagimlilik Sorunlari**: Bir sayfadaki hata digerlerini etkileyebilir
- **PWA Optimizasyonu eksik**: Offline stratejileri belirtilmemis

### 2. Backend (Firebase Functions)
- **Tek Dosya (index.ts)**: ~500 satir kod tek dosyada
- **Karma Karisik Mantik**: IPO bulma, hisse importu, fiyat sorgulama hepsi birlikte
- **Bakim Zorlugu**: Yeni ozellik eklemek riskli

---

## Hedeflenen Yapi (Moduler Mimari)

### 1. Frontend - Moduler Yapilandirma

```
src/
├── app/(app)/
│   ├── portfolio/page.tsx       # Bagimsiz - sadece portfoy verisi
│   ├── summary/page.tsx        # Bagimsiz - ozet verisi
│   ├── accounts/page.tsx       # Bagimsiz - hesap verisi
│   ├── ipos/page.tsx           # Bagimsiz - IPO verisi
│   └── stocks/page.tsx         # Bagimsiz - hisse listesi
├── components/
│   ├── portfolio/               # Portfoy ozel componentleri
│   │   ├── StatCard.tsx
│   │   ├── PortfolioTable.tsx
│   │   └── ...
│   ├── accounts/                # Hesap ozel componentleri
│   ├── ipos/                    # IPO ozel componentleri
│   ├── stocks/                  # Hisse ozel componentleri
│   └── shared/                  # Ortak UI componentleri
├── hooks/
│   ├── usePortfolio.ts          # Portfoy verisi icin özel hook
│   ├── useAccounts.ts           # Hesap verisi icin özel hook
│   ├── useIPOs.ts               # IPO verisi icin özel hook
│   └── useStocks.ts             # Hisse verisi icin özel hook
├── lib/
│   ├── firebase/
│   │   ├── config.ts            # Firebase yapilandirmasi
│   │   └── auth.ts              # Auth islemleri
│   └── services/
│       ├── portfolio-service.ts # Portfoy CRUD
│       ├── account-service.ts   # Hesap CRUD
│       ├── ipo-service.ts      # IPO CRUD
│       └── stock-service.ts     # Hisse CRUD
└── types/
    └── index.ts                # Tip tanimlamalari
```

**Faydalari:**
- Her sayfa kendi verisini kendi hook ile cekiyor
- Sadece kullanilan kodlar yuklenir (code splitting)
- Hata izolasyonu: Bir sayfa carpmaz digerlerini etkilemez
- Bakimi kolay: Her modul kendi sorumluluk alanina sahip

### 2. Backend - Mikro Fonksiyonlar

```
functions/src/
├── index.ts                    # Ana girdi (imports only)
├── api/
│   ├── stocks.ts               # Hisse listesi endpointleri
│   ├── quotes.ts               # Fiyat sorgulama
│   ├── ipo.ts                 # IPO keşfi ve yönetimi
│   └── sync.ts                # Zamanli sync isleri
└── utils/
    ├── twelvedata.ts          # TwelveData API wrapper
    ├── halkarz.ts             # Halkarz.com scraper
    └── cache.ts              # Cache yardimcilari
```

**Faydalari:**
- Her endpoint bagimsiz deploy edilebilir
- Hata izolasyonu
- Testi kolay
- Bakimi kolay

---

## PWA Tam Uyumluluk (Tamamlanmasi Gerekenler)

1. **Service Worker Yapilandirmasi**
   - Cache strategies (Cache First, Network First)
   - Offline fallback pages
   - Background sync (satislar icin)

2. **Manifest.json Guncellenmesi**
   - Icons (192x192, 512x512)
   - Theme colors
   - Display mode

3. **Native App Deneyimi**
   - Splash screen
   - Deep linking
   - Push notifications (ileride)

---

## Gecis Stratejisi (Adim Adim)

### Phase 1: PWA Optimizasyonu (1-2 gun)
- [ ] Service worker config duzeltmesi
- [ ] Offline fallback sayfalari
- [ ] Cache stratejileri

### Phase 2: Frontend Modulerlestirme (3-5 gun)
- [ ] Her sayfa icin ayri hook olusturma
- [ ] Service katmanini ayirma
- [ ] Componentleri ilgili klasorlere tasima

### Phase 3: Backend Modulerlestirme (2-3 gun)
- [ ] Fonksiyonlari ayri dosyalara tasima
- [ ] Her endpoint icin ayri dosya

---

## Tahmini Sure: 1-2 hafta

## Notlar
- Mevcut fonksiyonellik korunacak
- Migrasyon sirasinda老 sistem calisir durumda olacak
- Her adimda test yapilacak
