# Firebase push quraşdırılması

Tətbiq Firebase Cloud Messaging vasitəsilə birbaşa push göndərir. Native push
Expo Go-da işləmir; development və ya production build lazımdır.

## 1. Firebase layihəsini seç

1. [Firebase Console](https://console.firebase.google.com/) səhifəsini aç.
2. Mövcud Google layihəsini seç və ya yeni Firebase layihəsi yarat.
3. Google Sign-In üçün istifadə olunan OAuth client-lər bu layihəyə aiddirsə,
   eyni layihəni seç. Mobil və backend Firebase faylları eyni layihədən olmalıdır.

## 2. Android faylını əlavə et

1. Firebase layihəsinin `Project overview` səhifəsində Android işarəsinə bas.
2. `Android package name` sahəsinə dəqiq bunu yaz: `az.xosbextol.mobile`.
3. App nickname istəyə bağlıdır. Təkcə push üçün SHA-1 məcburi deyil.
4. `Register app` seç və `google-services.json` faylını endir.
5. Faylın adını dəyişmədən bu ünvana köçür:
   `mobile/google-services.json`.

Brauzer faylı `google-services (1).json` kimi endirərsə, adını mütləq
`google-services.json` et.

## 3. iOS faylını əlavə et

1. Firebase `Project overview` səhifəsində `Add app` seçib iOS işarəsinə bas.
2. `Apple bundle ID` sahəsinə dəqiq bunu yaz: `az.xosbextol.mobile`.
3. `Register app` seç və `GoogleService-Info.plist` faylını endir.
4. Faylı bu ünvana köçür:
   `mobile/GoogleService-Info.plist`.

Bu iki mobil konfiqurasiya faylında client identifikatorları var və EAS build
zamanı əlçatan olmalıdır. Fayllar Git tərəfindən ignore edilir və lokal/EAS build
mühitində ayrıca təmin olunmalıdır. Firebase Admin service-account faylı isə
gizlidir və repozitoriyaya əlavə edilməməlidir.

## 4. Backend üçün Firebase Admin açarı

1. Firebase Console-da dişli işarəsi → `Project settings` → `Service accounts` aç.
2. `Firebase Admin SDK` bölməsində `Generate new private key` seç.
3. Endirilən JSON faylını repozitoriyadan kənarda saxla, məsələn:
   `C:/secure/firebase/xosbextol-service-account.json`.
4. Layihənin kökündəki `.env` faylına əlavə et:

   ```properties
   FIREBASE_ENABLED=true
   FIREBASE_CREDENTIALS=C:/secure/firebase/xosbextol-service-account.json
   ```

Bu service-account JSON faylını Git-ə commit etmə və heç kimlə paylaşma.

## 5. iPhone üçün APNs açarı

1. Apple Developer hesabında `Certificates, Identifiers & Profiles` → `Keys`
   bölməsindən APNs açarı yarat və `.p8` faylını endir.
2. Key ID və Team ID-ni qeyd et. `.p8` faylı yalnız bir dəfə endirilir.
3. Firebase-də `Project settings` → `Cloud Messaging` → iOS app configuration
   bölməsində APNs authentication key-i yüklə.

Bu addım Android testi üçün lazım deyil. iOS build və real iPhone push testi
üçün Apple Developer hesabı lazımdır.

## 6. Development build yarat

Əvvəl Android ilə yoxlamaq daha rahatdır:

```powershell
cd mobile
npx eas-cli@latest login
npm run build:development:android
```

EAS build bitdikdən sonra verilən linkdən APK-nı real Android telefona quraşdır.
Sonra Metro serverini başlat:

```powershell
npm run dev-client -- --clear
```

Telefonda Expo Go əvəzinə quraşdırılmış `Xoşbəxt Ol` development tətbiqini aç.
iOS build üçün:

```powershell
npm run build:development:ios
```

İstifadəçi bildiriş icazəsi verdikdən sonra Firebase Installation ID backend-də
`POST /api/users/me/devices` vasitəsilə qeyd olunur. Logout həmin cihazı ləğv edir.

Rəsmi mənbələr:

- [Firebase Android setup](https://firebase.google.com/docs/android/setup)
- [Firebase Apple setup](https://firebase.google.com/docs/ios/setup)
- [Firebase iOS/APNs setup](https://firebase.google.com/docs/cloud-messaging/ios/get-started)
- [Expo FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)
