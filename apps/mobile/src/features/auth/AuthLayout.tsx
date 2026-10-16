/**
 * Kerangka layar alur masuk.
 * - `AuroraScreen`: latar aurora gelap (Masuk, TOTP, buka-kunci) — selalu malam.
 * - `FormScreen`: layar formulir terang/gelap mengikuti tema, dengan app bar
 *   sub, isi bergulir, dan bilah aksi bawah yang naik bersama papan ketik.
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DarkScope, layout, radius, useTheme } from '@/theme';
import { ActionBar, Gradient, Icon, PageGlow, SubAppBar, Text, type AnyIconName } from '@/ui';

import { Aurora } from './Aurora';

/** `true` selama papan ketik terbuka (header Masuk memadat). */
export function useKeyboardTerbuka(): boolean {
  const [terbuka, setTerbuka] = useState(false);
  useEffect(() => {
    const tampil = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTerbuka(true));
    const sembunyi = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTerbuka(false));
    return () => {
      tampil.remove();
      sembunyi.remove();
    };
  }, []);
  return terbuka;
}

/** Ubin logo gradien merek (ikon sidik jari = identitas RuangKerja di Masuk). */
export function LogoRuangKerja({ ukuran = 56, icon = 'fingerprint' }: { ukuran?: number; icon?: AnyIconName }): React.JSX.Element {
  return (
    <Gradient name="merek" style={{ width: ukuran, height: ukuran, borderRadius: ukuran * 0.3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <Icon name={icon} size={ukuran * 0.55} color="#FFFFFF" strokeWidth={1.7} />
    </Gradient>
  );
}

export function AuroraScreen({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <DarkScope>
      <AuroraBody insetTop={insets.top} insetBottom={insets.bottom} footer={footer}>
        {children}
      </AuroraBody>
    </DarkScope>
  );
}

function AuroraBody({ children, footer, insetTop, insetBottom }: { children: React.ReactNode; footer?: React.ReactNode; insetTop: number; insetBottom: number }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Aurora />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insetTop + 24, paddingBottom: insetBottom + 20, paddingHorizontal: 24, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
}

export function FormScreen({
  title,
  onBack,
  children,
  footer,
  hideBack = false,
}: {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
  /** Isi bilah aksi bawah (kolom): tombol utama lalu tautan. */
  footer?: React.ReactNode;
  hideBack?: boolean;
}): React.JSX.Element {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <PageGlow />
      {hideBack ? <TitleBar title={title} top={insets.top} /> : <SubAppBar title={title} onBack={onBack} />}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 16, paddingBottom: 24, gap: 16 }}
        >
          {children}
        </ScrollView>
        {footer ? (
          <ActionBar>
            <View style={{ flex: 1, gap: 4 }}>{footer}</View>
          </ActionBar>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function TitleBar({ title, top }: { title: string; top: number }): React.JSX.Element {
  return (
    <View style={{ paddingTop: top, height: top + layout.appBar, justifyContent: 'center', paddingHorizontal: layout.gutter }}>
      <Text variant="title" weight={700}>
        {title}
      </Text>
    </View>
  );
}

/** Ubin ikon besar di tengah layar status (blokir, versi, pemeliharaan). */
export function IkonStatus({ icon, tone = 'primary' }: { icon: AnyIconName; tone?: 'primary' | 'warning' | 'danger' | 'info' }): React.JSX.Element {
  const { colors } = useTheme();
  const pasang = {
    primary: { bg: colors.linkSoft, fg: colors.primary },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: colors.infoSoft, fg: colors.info },
  }[tone];
  return (
    <View style={[s.ubin, { backgroundColor: pasang.bg }]}>
      <Icon name={icon} size={36} color={pasang.fg} />
    </View>
  );
}

const s = StyleSheet.create({
  ubin: { width: 80, height: 80, borderRadius: radius['2xl'], alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});

/** Pesan galat kolom (ikon + teks bahaya) untuk kolom yang labelnya dibuat sendiri. */
export function GalatKolom({ message }: { message: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Icon name="circle-alert" size={14} color={colors.danger} />
      <Text variant="meta" tone="danger" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
