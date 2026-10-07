import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import Check from 'lucide-react-native/icons/check';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { fieldError, errorMessage } from '../lib/errors';
import { validateInstagram, validatePhone } from '../lib/validators';
import { isPushSupported, needsWebNotificationPrompt } from '../lib/push';
import { unblockInstructions, useNotificationStatus } from '../lib/notifications';
import { writeHandoffCookie } from '../lib/handoff';
import { clearInstallPrompt, getInstallPrompt, isAndroidWeb, isIOS, isStandalone } from '../lib/platform-web';
import { isOnboardingStep, type TourStep } from '../lib/tour';
import { useTour } from '../components/tour/TourProvider';
import { EMBER, PAPER } from '../components/tour/colors';
import FormField from '../components/FormField';
import FadeIn from '../components/FadeIn';
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
  /** APK - vysvětlení před systémovým dialogem (dřív vyskočil hned po registraci). */
  | 'native'
  /** Nativní iOS (bez pushe) nebo už povolená oznámení. */
  | 'none';

function installVariant(): InstallVariant {
  if (isPushSupported) return 'native';
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

  // Na APK se stav povolení zjišťuje asynchronně (Android < 13 má povoleno
  // rovnou) - do té doby krok čeká, ať neproblikne.
  const notif = useNotificationStatus();
  const nativeReady = variant !== 'native' || notif.status != null;
  const skipInstall = variant === 'none' || (variant === 'native' && notif.status != null && notif.status !== 'default');

  // Nemá-li krok s plochou co nabídnout, rovnou se přeskočí.
  useEffect(() => {
    if (screen === 'install' && skipInstall) goTo('ring');
  }, [screen, skipInstall, goTo]);

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
      {screen === 'install' && variant !== 'none' && !skipInstall && nativeReady && (
        <InstallStep variant={step === 'notify' ? 'notifyOnly' : variant} onNext={finish} bottom={insets.bottom} />
      )}

      {screen !== 'intro' && (
        <SkipTour
          top={insets.top + 24}
          onSkip={() => {
            skip();
            router.replace('/');
          }}
        />
      )}
    </View>
  );
}

/**
 * "Přeskočit průvodce" na dvě klepnutí - stejně jako v kartách nápověd
 * (components/tour/TipCard.tsx). Potvrzení vyjede jako malá karta pod
 * odkazem, výchozí volbou je pokračovat.
 */
function SkipTour({ top, onSkip }: { top: number; onSkip: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Pressable
        onPress={() => setConfirming(true)}
        accessibilityRole="button"
        hitSlop={4}
        className="absolute right-6"
        style={{ top }}
      >
        <Text className="text-[#2B2724]/50 text-sm">Přeskočit průvodce</Text>
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      className="absolute right-4 left-4 bg-[#FCFBF8] rounded-[20px] border border-[#E7E3DC] px-[18px] pt-4 pb-3 max-w-[380px] self-end"
      style={{ top: top - 8, elevation: 6, shadowColor: '#2B2724', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}
    >
      <Text className="text-[#2B2724] text-[15px] leading-[22px] font-semibold">Opravdu přeskočit průvodce?</Text>
      <Text className="text-[#2B2724]/70 text-[14px] leading-5 mt-0.5">Spustit ho můžeš znovu v nastavení.</Text>
      <View className="flex-row items-center justify-end gap-2 mt-2.5">
        <Pressable
          onPress={() => setConfirming(false)}
          accessibilityRole="button"
          className="rounded-full px-[18px] py-[9px] bg-[#EE6C4D] active:opacity-80"
        >
          <Text className="text-white font-semibold text-[15px]">Pokračovat</Text>
        </Pressable>
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          className="rounded-full px-[14px] py-[9px] border border-[#E7E3DC] active:bg-[#E7E3DC]/40"
        >
          <Text className="text-[#2B2724]/70 text-[15px]">Přeskočit</Text>
        </Pressable>
      </View>
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
  const notif = useNotificationStatus();
  // `default` po zavřeném dialogu není "zablokováno" - jde se zeptat znovu.
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const notifState: 'ask' | 'granted' | 'denied' =
    notif.status === 'granted'
      ? 'granted'
      : notif.status === 'denied' || notif.status === 'unsupported'
        ? 'denied'
        : 'ask';
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
    // Volá Notification.requestPermission() synchronně - musí to být přímo
    // z klepnutí.
    const next = await notif.enable().catch(() => null);
    setAskingNotif(false);
    setDismissedPrompt(next === 'default');
    // Chvíli nechat vidět potvrzení, ať přechod dál nepůsobí jako chyba.
    if ((variant === 'notifyOnly' || variant === 'native') && next === 'granted') setTimeout(onNext, 700);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    clearInstallPrompt();
    setInstallPrompt(null);
  };

  const headline =
    variant === 'notifyOnly' || variant === 'native'
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
              {notifState === 'granted' ? (
                <NotificationsOn />
              ) : (
                <PrimaryButton
                  label={notifState === 'denied' ? 'Oznámení jsou zablokovaná' : 'Zapnout oznámení'}
                  onPress={enableNotifications}
                  loading={askingNotif}
                  disabled={notifState === 'denied'}
                />
              )}
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
                  Na plochu si ho přidáš přes menu prohlížeče (tři tečky) a volbu Přidat na plochu.
                </Text>
              )}
            </View>
          </>
        )}

        {variant === 'native' && (
          <Text className="text-[#2B2724]/70 text-base leading-6 mt-2">
            Pošleme ti oznámení, když ti někdo pošle žádost o přátelství nebo když mají přátelé volno. Nic jiného.
          </Text>
        )}

        {(variant === 'notifyOnly' || variant === 'native') && (
          <View className="mt-8 gap-3">
            {notifState === 'denied' ? (
              <Text className="text-gray-500 text-sm leading-5">
                Oznámení jsou zablokovaná. {unblockInstructions()}
              </Text>
            ) : notifState === 'granted' ? (
              <NotificationsOn />
            ) : (
              <PrimaryButton label="Zapnout oznámení" onPress={enableNotifications} loading={askingNotif} />
            )}
            {dismissedPrompt && notifState === 'ask' && (
              <Text className="text-gray-500 text-sm leading-5">Dialog se zavřel bez volby. Zkus to znovu.</Text>
            )}
          </View>
        )}

        {notifState === 'denied' && variant === 'android' && (
          <Text className="text-gray-500 text-sm leading-5 mt-3">{unblockInstructions()}</Text>
        )}
      </View>

      <Pressable onPress={onNext} accessibilityRole="button" className="py-3 mt-8 items-center">
        <Text className="text-[#2B2724]/60 text-base">
          {variant === 'ios'
            ? 'Pokračovat tady v Safari'
            : (variant === 'notifyOnly' || variant === 'native') && notifState !== 'granted'
              ? 'Teď ne'
              : 'Pokračovat'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * Potvrzení na místě tlačítka "Zapnout oznámení": stejná výška i zaoblení,
 * takže se tlačítko v klidu promění a nic pod ním neposkočí. Klidné
 * papírové pozadí místo akcentu - už to není výzva k akci.
 */
function NotificationsOn() {
  return (
    <FadeIn>
      <View
        accessibilityLiveRegion="polite"
        className="flex-row items-center justify-center gap-2.5 py-4 rounded-2xl bg-[#FCFBF8] border border-[#E7E3DC]"
      >
        <View className="w-6 h-6 rounded-full bg-[#EE6C4D] items-center justify-center">
          <Check size={14} color="#fff" strokeWidth={3} />
        </View>
        <Text className="text-[#2B2724] font-semibold text-lg">Oznámení máš zapnutá</Text>
      </View>
    </FadeIn>
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
