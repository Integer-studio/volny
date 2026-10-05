import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { fieldError, errorMessage } from '../lib/errors';
import { validateInstagram, validatePhone } from '../lib/validators';
import { needsWebNotificationPrompt } from '../lib/push';
import { writeHandoffCookie } from '../lib/handoff';
import { clearInstallPrompt, getInstallPrompt, isAndroidWeb, isIOS, isStandalone } from '../lib/platform-web';
import { isOnboardingStep, type TourStep } from '../lib/tour';
import { useTour } from '../components/tour/TourProvider';
import { EMBER, PAPER } from '../components/tour/colors';
import FormField from '../components/FormField';
import InstallVideo from '../components/onboarding/InstallVideo';
import { useToast } from '../components/Toast';

/**
 * Úvodní část průvodce po registraci (task 0019): úvod, kontakt a přidání
 * na plochu / zapnutí oznámení. Pak se pokračuje nápovědami nad skutečnou
 * hlavní obrazovkou (components/tour/TourOverlay.tsx).
 */
type InstallVariant =
  /** Safari na iOS - jediná cesta k oznámením je aplikace z plochy. */
  | 'ios'
  /** Chrome a spol. na Androidu - instalace je bonus, oznámení jdou i z prohlížeče. */
  | 'android'
  /** Desktop, nainstalovaná PWA, aplikace z plochy iOS - zbývá jen povolit oznámení. */
  | 'notifyOnly'
  /** Nativní APK (oznámení řeší PushGate) nebo už povolená oznámení. */
  | 'none';

function installVariant(): InstallVariant {
  if (Platform.OS !== 'web') return 'none';
  if (isIOS() && !isStandalone()) return 'ios';
  if (isAndroidWeb() && !isStandalone()) return 'android';
  return needsWebNotificationPrompt() ? 'notifyOnly' : 'none';
}

const SEGMENTS: TourStep[] = ['intro', 'contact', 'install'];

export default function Onboarding() {
  const { step, goTo, advance, skip } = useTour();
  const insets = useSafeAreaInsets();
  const [variant] = useState(installVariant);

  // `notify` je druhá polovina kroku `install` - jen v aplikaci z plochy iOS.
  const screen: TourStep | null = step === 'notify' ? 'install' : step;

  useEffect(() => {
    if (!isOnboardingStep(step)) router.replace('/');
  }, [step]);

  // Nemá-li krok s plochou co nabídnout, rovnou se přeskočí.
  useEffect(() => {
    if (screen === 'install' && variant === 'none') goTo('ring');
  }, [screen, variant, goTo]);

  if (!screen || !isOnboardingStep(screen)) return <View className="flex-1 bg-[#FCFBF8]" />;

  const finish = () => {
    goTo('ring');
    router.replace('/');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: screen === 'intro' ? EMBER : PAPER }}>
      <View style={{ paddingTop: insets.top + 12 }} className="px-6 flex-row gap-1.5">
        {SEGMENTS.map(s => (
          <View
            key={s}
            className="flex-1 h-1 rounded-full"
            style={{
              backgroundColor:
                screen === 'intro'
                  ? s === 'intro'
                    ? PAPER
                    : 'rgba(252,251,248,0.35)'
                  : SEGMENTS.indexOf(s) <= SEGMENTS.indexOf(screen)
                    ? EMBER
                    : '#E7E3DC',
            }}
          />
        ))}
      </View>

      {screen === 'intro' && <IntroStep onNext={() => advance('intro')} bottom={insets.bottom} />}
      {screen === 'contact' && <ContactStep onNext={() => advance('contact')} bottom={insets.bottom} />}
      {screen === 'install' && variant !== 'none' && (
        <InstallStep variant={step === 'notify' ? 'notifyOnly' : variant} onNext={finish} bottom={insets.bottom} />
      )}

      {screen !== 'intro' && (
        <Pressable
          onPress={() => {
            skip();
            router.replace('/');
          }}
          accessibilityRole="button"
          hitSlop={8}
          className="absolute right-6"
          style={{ top: insets.top + 24 }}
        >
          <Text className="text-[#2B2724]/50 text-sm">Přeskočit průvodce</Text>
        </Pressable>
      )}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  inverted,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  inverted?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      className={`py-4 rounded-2xl items-center active:opacity-80 ${disabled ? 'opacity-40' : ''}`}
      style={{ backgroundColor: inverted ? PAPER : EMBER }}
    >
      {loading ? (
        <ActivityIndicator color={inverted ? EMBER : '#fff'} />
      ) : (
        <Text className="font-bold text-lg" style={{ color: inverted ? EMBER : '#fff' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function IntroStep({ onNext, bottom }: { onNext: () => void; bottom: number }) {
  const { width } = useWindowDimensions();
  // Kus prstence, který přetéká přes pravý okraj - stejný motiv jako
  // hlavní ovladač, aby úvod a appka působily jako jedna věc.
  const ring = Math.min(width * 1.1, 520);
  const stroke = 22;
  const r = ring / 2 - stroke;
  const circ = 2 * Math.PI * r;

  return (
    <View className="flex-1 px-6 justify-between" style={{ paddingBottom: bottom + 24 }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', right: -ring * 0.42, bottom: ring * 0.18 + bottom, width: ring, height: ring }}
      >
        <Svg width={ring} height={ring}>
          <Circle cx={ring / 2} cy={ring / 2} r={r} stroke="rgba(252,251,248,0.18)" strokeWidth={stroke} fill="none" />
          <Circle
            cx={ring / 2}
            cy={ring / 2}
            r={r}
            stroke={PAPER}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circ * 0.62} ${circ}`}
            transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
          />
        </Svg>
      </View>

      <Text
        accessibilityRole="header"
        className="mt-12 text-[#FCFBF8] font-extrabold max-w-[420px]"
        style={{ fontSize: 34, lineHeight: 40, letterSpacing: -0.6 }}
      >
        Teď už můžeš dávat přátelům vědět, kdy jsi Volný/á – a nebudeš znít jako žebrák!
      </Text>

      <PrimaryButton label="Jdeme na to" onPress={onNext} inverted />
    </View>
  );
}

function ContactStep({ onNext, bottom }: { onNext: () => void; bottom: number }) {
  const { me, refreshMe } = useAuth();
  const { show } = useToast();
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [instagram, setInstagram] = useState(me?.instagram ?? '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [instagramError, setInstagramError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const filled = phone.trim().length > 0 || instagram.trim().length > 0;

  const save = async () => {
    const pe = validatePhone(phone.trim());
    const ie = validateInstagram(instagram.trim());
    setPhoneError(pe);
    setInstagramError(ie);
    if (pe || ie) return;

    setSaving(true);
    try {
      await api.updateProfile({ phone: phone.trim(), instagram: instagram.trim() });
      await refreshMe();
      onNext();
    } catch (e) {
      const pErr = fieldError(e, 'phone');
      const iErr = fieldError(e, 'instagram');
      setPhoneError(pErr);
      setInstagramError(iErr);
      if (!pErr && !iErr) show(errorMessage(e, 'Uložení se nezdařilo.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: bottom + 24 }}
    >
      <View className="flex-1 mt-16 max-w-[460px] w-full">
        <Text accessibilityRole="header" className="text-[#2B2724] text-2xl font-bold leading-8 mb-3">
          Na jaké číslo ti budou přátelé volat?
        </Text>
        <FormField
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={phoneError}
        />

        <Text accessibilityRole="header" className="text-[#2B2724] text-2xl font-bold leading-8 mt-6 mb-3">
          Na jaký Instagram ti budou přátelé psát?
        </Text>
        <FormField
          label="Instagram"
          prefix="@"
          value={instagram}
          onChangeText={v => setInstagram(v.replace(/^@+/, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          error={instagramError}
        />

        <Text className="text-gray-500 text-sm leading-5 mt-1">
          Nepovinné. Vidí ho jen přátelé a spolučlenové skupin, nikdo jiný. Změnit ho můžeš kdykoli v nastavení.
        </Text>
      </View>

      <View className="mt-8 gap-2">
        <PrimaryButton label="Uložit a pokračovat" onPress={save} loading={saving} disabled={!filled} />
        <Pressable onPress={onNext} accessibilityRole="button" className="py-3 items-center">
          <Text className="text-[#2B2724]/60 text-base">Teď ne</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InstallStep({
  variant,
  onNext,
  bottom,
}: {
  variant: Exclude<InstallVariant, 'none'>;
  onNext: () => void;
  bottom: number;
}) {
  const { height } = useWindowDimensions();
  const [askingNotif, setAskingNotif] = useState(false);
  const [notifState, setNotifState] = useState<'ask' | 'granted' | 'denied'>(() =>
    needsWebNotificationPrompt() ? 'ask' : 'granted',
  );
  const [installPrompt, setInstallPrompt] = useState(getInstallPrompt);

  // Kód pro přenos přihlášení do aplikace z plochy (lib/handoff.ts). Vytváří
  // se při vstupu do kroku, aby cookie existovala dřív, než uživatel klepne
  // na "Přidat na plochu" - iOS ji kopíruje právě v tu chvíli.
  useEffect(() => {
    if (variant !== 'ios') return;
    api
      .createHandoff()
      .then(writeHandoffCookie)
      .catch(() => {});
  }, [variant]);

  // `beforeinstallprompt` může přijít i až po načtení stránky.
  useEffect(() => {
    if (variant !== 'android' || installPrompt) return;
    const t = setInterval(() => {
      const p = getInstallPrompt();
      if (p) setInstallPrompt(p);
    }, 500);
    return () => clearInterval(t);
  }, [variant, installPrompt]);

  const enableNotifications = async () => {
    setAskingNotif(true);
    // Volá Notification.requestPermission() - musí to být přímo z klepnutí.
    await api.registerPushToken().catch(() => null);
    setAskingNotif(false);
    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    setNotifState(perm === 'granted' ? 'granted' : 'denied');
    if (variant === 'notifyOnly' && perm === 'granted') onNext();
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    clearInstallPrompt();
    setInstallPrompt(null);
  };

  const headline =
    variant === 'notifyOnly'
      ? 'Zapni si oznámení, ať víš, kdy mají přátelé volno.'
      : 'Chceš vědět jako první, kdy jsou tví přátelé Volní?';

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: bottom + 24 }}>
      <View className="flex-1 mt-16 max-w-[460px] w-full">
        <Text accessibilityRole="header" className="text-[#2B2724] text-2xl font-bold leading-8">
          {headline}
        </Text>

        {variant === 'ios' && (
          <>
            <Text className="text-[#2B2724]/70 text-base leading-6 mt-2">Přidej si Volný na plochu.</Text>
            <View className="mt-6 items-center">
              <InstallVideo height={Math.min(420, Math.max(260, height * 0.45))} />
            </View>
            <View className="mt-6">
              <View className="gap-3">
                <IosStep n={1} text="Klepni na ⋯ a pak na Sdílet." />
                <IosStep n={2} text="Vyber Přidat na plochu." />
                <IosStep n={3} text="Nech zapnuté Otevřít jako webovou aplikaci a klepni na Přidat." />
              </View>
            </View>
            <Text className="text-gray-500 text-sm leading-5 mt-6">
              Pak otevři Volný z plochy – budeš rovnou přihlášený/á a zapneš si tam oznámení.
            </Text>
          </>
        )}

        {variant === 'android' && (
          <>
            <Text className="text-[#2B2724]/70 text-base leading-6 mt-2">
              Zapni si oznámení. A když si Volný přidáš na plochu, budeš ho mít po ruce jako aplikaci.
            </Text>
            <View className="gap-3 mt-8">
              {notifState !== 'granted' && (
                <PrimaryButton
                  label={notifState === 'denied' ? 'Oznámení jsou zablokovaná' : 'Zapnout oznámení'}
                  onPress={enableNotifications}
                  loading={askingNotif}
                  disabled={notifState === 'denied'}
                />
              )}
              {notifState === 'granted' && <Text className="text-[#2B2724] text-base">✓ Oznámení máš zapnutá.</Text>}
              {installPrompt ? (
                <Pressable
                  onPress={install}
                  accessibilityRole="button"
                  className="py-4 rounded-2xl items-center border border-[#EE6C4D] active:bg-[#EE6C4D]/5"
                >
                  <Text className="text-[#EE6C4D] font-bold text-lg">Přidat na plochu</Text>
                </Pressable>
              ) : (
                <Text className="text-gray-500 text-sm leading-5">
                  Na plochu si ho přidáš v menu prohlížeče ⋮ → Přidat na plochu.
                </Text>
              )}
            </View>
          </>
        )}

        {variant === 'notifyOnly' && (
          <View className="mt-8 gap-3">
            {notifState === 'denied' ? (
              <Text className="text-gray-500 text-sm leading-5">
                Oznámení jsou v prohlížeči zablokovaná. Povolit je můžeš v nastavení webu.
              </Text>
            ) : (
              <PrimaryButton label="Zapnout oznámení" onPress={enableNotifications} loading={askingNotif} />
            )}
          </View>
        )}

        {notifState === 'denied' && variant === 'android' && (
          <Text className="text-gray-500 text-sm leading-5 mt-3">
            Povolit je můžeš v nastavení webu (ikona vlevo od adresy).
          </Text>
        )}
      </View>

      <Pressable onPress={onNext} accessibilityRole="button" className="py-3 mt-8 items-center">
        <Text className="text-[#2B2724]/60 text-base">
          {variant === 'ios' ? 'Pokračovat tady v Safari' : variant === 'notifyOnly' ? 'Teď ne' : 'Pokračovat'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function IosStep({ n, text }: { n: number; text: string }) {
  return (
    <View className="flex-row gap-2.5">
      <View className="w-6 h-6 rounded-full bg-[#EE6C4D] items-center justify-center mt-0.5">
        <Text className="text-white text-xs font-bold">{n}</Text>
      </View>
      <Text className="flex-1 text-[#2B2724] text-[15px] leading-[22px]">{text}</Text>
    </View>
  );
}
