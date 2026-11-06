# Xoşbəxt Ol mobil tətbiqi

Expo SDK 57, React Native və TypeScript ilə yazılmış Android/iOS tətbiqidir. Mövcud Spring Boot API-dən istifadə edir.

## İşə salma

Backend servislərini repo kökündən başladın:

```powershell
Copy-Item .env.example .env
docker compose up -d
.\gradlew.bat bootRun --args='--spring.profiles.active=dev'
```

Sonra başqa terminalda mobil tətbiqi başladın:

```powershell
cd mobile
Copy-Item .env.example .env
npm install
npx expo run:android
npm run start
```

`react-native-keychain` native modul olduğuna görə biometrik giriş Expo Go-da işləmir. Əvvəlcə Android üçün `npx expo run:android`, macOS-da iOS üçün `npx expo run:ios` ilə development build-i cihazda quraşdırın. Sonrakı JavaScript dəyişikliklərində yalnız `npm run start` işlətmək kifayətdir.

Windows-dan fiziki iOS cihazı üçün EAS development build yaradın və cihazda quraşdırın:

```powershell
npx eas-cli@latest build --profile development --platform ios
```

Şəbəkə LAN bağlantısını bloklayırsa development client üçün tunnel rejimindən istifadə edin:

```powershell
npm run dev-client:tunnel
```

- Android emulator üçün standart API ünvanı `http://10.0.2.2:8090`-dır.
- iOS simulator üçün standart API ünvanı `http://localhost:8090`-dır.
- Fiziki telefonda `.env` faylında kompüterin lokal IP-sini yazın, məsələn `EXPO_PUBLIC_API_URL=http://192.168.1.20:8090`. Telefon və kompüter eyni şəbəkədə olmalıdır.
- `npm run android` quraşdırılmış development client-i Android emulatorunda, `npm run ios` isə macOS-da iOS simulatorunda açır.
- Development zamanı `8081` portunda Expo Metro bundler işləyir; bu web tətbiqi deyil, native tətbiqə JavaScript paketini ötürən development servisidir.

OTP kodu lokal Mailpit-də görünür: `http://localhost:8025`.

## Funksiyalar

- Email/şifrə ilə giriş, OTP ilə qeydiyyat və şifrə bərpası, avtomatik token yeniləmə və SecureStore-da təhlükəsiz sessiya
- Məkan axtarışı, şəhər/qonaq/reytinq filtrləri, detallı məlumat və rəylər
- Favoritlər, rezervasiya, promo kod, əlavə xidmət, ödəniş və ləğv
- Tamamlanmış rezervasiya üçün rəy
- Profil, dil, aktiv sessiyalar, push cihazları və bildirişlər
- Zal sahibi üçün məkan, zal, şəkil, imkan, əlavə xidmət və bağlı tarix idarəsi
- Zal sahibi üçün rezervasiya siyahısı və məkan hesabatı
- Admin üçün dashboard, məkan təsdiqi, istifadəçi/rol, promo kod və audit idarəsi

## Google ilə giriş

Mobil `.env` faylında platformalara uyğun Google OAuth client ID-lərini yazın:

```properties
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
```

Google Cloud Console-da Android client üçün `az.xosbextol.mobile` package adını və build imzasının SHA-1 dəyərini, iOS client üçün isə eyni bundle identifier-i qeyd edin. Backend `.env` faylındakı `GOOGLE_CLIENT_IDS` dəyişəninə hər iki client ID-ni vergüllə ayıraraq yazın.

Google girişi iOS və Android-də OAuth code + PKCE və backend nonce yoxlamasından istifadə edir. Girişi development build-də yoxlayın:

```powershell
npx expo run:android
npx expo run:ios
```

Windows-dan fiziki iOS cihazı üçün EAS development build yaradın:

```powershell
npx eas-cli@latest build --profile development --platform ios
```

Expo Go `exp://` redirect istifadə etdiyi üçün Google native OAuth client-ləri ilə giriş üçün uyğun deyil.

## Yoxlamalar

```powershell
npm run typecheck
npx expo lint
npx expo-doctor
npx expo export --platform android
```
