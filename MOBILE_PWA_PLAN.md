# Mobile-First PWA Optimizasyon Plani

## Mevcut Durum Analizi

### Problemler
1. **Tablolar**: 6 sutunlu tablolar mobilde tasma yapiyor (overflow-x-auto var ama kullanisli degil)
2. **Navigasyon**: Horizontal scroll bar mevcut, tiklanmasi zor
3. **Butonlar**: Kucuk ve sik
4. **Inputlar**: Kucuk font, dar alanlar
5. **Padding/Margin**: Mobil icin fazla bosluk
6. **Font Boyutlari**: Mobil okunabilirlik icin kucuk
7. **Modal/Popup**: Buyuk ekranlar icin tasarlanmis, mobilde ekrani dolduruyor ama icerik kucuk
8. **Touch Hedefleri**: Minimum 44px (Apple standarti) veya 48dp (Android Material) gerekli

---

## Hedefler

1. **Telefon Dik Pozisyonda** tam ekran kullanilabilir olmali
2. **Parmakla Tiklama** rahat olmali (min 48px touch hedefleri)
3. **Dikey Scroll** tek parmakla rahat
4. **Veri Girisi**: Buyuk input alanlari, numeric keypad destegi
5. **Bir elle Kullanim**: En onemli islemler alta yakin olmali

---

## Uygulama Plani

### Phase 1: Layout & Navigation (2-3 saat)

| # | Degisiklik | Detay |
|---|------------|-------|
| 1.1 | Bottom Navigation Bar | Ana menuleri alta sabitle, kucuk ikon + etiket |
| 1.2 | Header | Sadece logo + geri butonu + profil, daha kucuk |
| 1.3 | Container padding | `px-4 py-4` (mobil), `px-6 py-10` (desktop) |
| 1.4 | Card yapisi | Tam genislik, rounded-xl, minimum bosluk |
| 1.5 | Stat Kartlari | 2 sutun yerine 1 sutun veya 2 sutun dar |

### Phase 2: Tables to Cards (3-4 saat)

| # | Degisiklik | Detay |
|---|------------|-------|
| 2.1 | Portfoy Tablosu | Her hisseyi karta donustur |
| 2.2 | IPO Listesi | Card-based list |
| 2.3 | Hisse Listesi | Card-based list |
| 2.4 | Hesap Listesi | Card-based list |
| 2.5 |ozet Sayfasi | Tamamen kart tabanli |

**Card Yapisi (Mobil):**
```
┌─────────────────────────────┐
│ THYAO              [H] [P] │  <- Hisse kodu + tur etiketleri
├─────────────────────────────┤
│ Lot: 15    Maliyet: 4.500  │
│ Deger: 6.750  Kar: +2.250  │
├─────────────────────────────┤
│ [SATIS] [DETAY]            │  <- Buyuk butonlar
└─────────────────────────────┘
```

### Phase 3: Forms & Inputs (2 saat)

| # | Degisiklik | Detay |
|---|------------|-------|
| 3.1 | Input boyutlari | h-14 (56px), text-lg |
| 3.2 | Label | Input ustunde, buyuk |
| 3.3 | Numeric input | inputmode="decimal" for numbers |
| 3.4 | Select boxes | Buyuk, kolay acilir |
| 3.5 | Date picker | Mobil uyumlu |

### Phase 4: Modals & Popups (1-2 saat)

| # | Degisiklik | Detay |
|---|------------|-------|
| 4.1 | Full-screen modal | Mobilde ekrani kaplasin |
| 4.2 | Bottom sheet | Formlar icin alttan acilsin |
| 4.3 | Action sheet | Secenekler icin alttan menu |
| 4.4 | Kapanis | Buyuk X butonu veya swipe to close |

### Phase 5: PWA Optimizasyon (1 saat)

| # | Degisiklik | Detay |
|---|------------|-------|
| 5.1 | Manifest guncelle | `display: standalone`, `orientation: portrait` |
| 5.2 | Splash screen | Renk ve icon |
| 5.3 | Theme color | Dynamic, app rengine uyumlu |
| 5.4 | Install prompt | UsePWAInstallKit veya benzeri |
| 5.5 | Offline page | Ozel "Baglanti Yok" sayfasi |

### Phase 6: UX Iyilestirmeler (1-2 saat)

| # | Degisiklik | Detay |
|---|------------|-------|
| 6.1 | Haptic feedback | Button tiklamalarinda titreşim |
| 6.2 | Loading states | Skeleton loaders |
| 6.3 | Pull-to-refresh | Listelerde |
| 6.4 | Swipe gestures | Soldan saga = geri |
| 6.5 | Keyboard handling | Inputa gectiginde ekran kaymasi |

---

## Degisiklik Yapilacak Dosyalar

1. `src/components/AppFrame.tsx` - Navigasyon
2. `src/app/(app)/layout.tsx` - Genel layout
3. `src/app/(app)/portfolio/page.tsx` - Portfoy
4. `src/app/(app)/ipos/page.tsx` - IPO'lar
5. `src/app/(app)/stocks/page.tsx` - Hisseler
6. `src/app/(app)/accounts/page.tsx` - Hesaplar
7. `src/app/(app)/summary/page.tsx` - Ozet
8. `src/components/*Modal.tsx` - Tum modal componentleri
9. `public/manifest.json` - PWA manifest

---

## Onemli Notlar

- **Dark mode zaten var**, korunacak
- **Mevcut fonksiyonellik bozulmayacak**, sadece UI
- **Animasyonlar**: Framer Motion kullanilabilir ama mobilde hafif tut
- **Resimler**: Lazy loading, uygun boyutlar
- **Performance**: Lighthouse PWA score 90+ hedefi

---

## Tahmini Sure: ~10-12 saat

Onaylarsaniz Phase 1'den baslayalim.
