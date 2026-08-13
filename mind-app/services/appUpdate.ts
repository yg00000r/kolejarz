import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { Alert, Linking, Platform } from 'react-native';
import { BASE_URL } from '../constants/api';
import { APP_VERSION } from '../constants/version';

/**
 * LEGACY / iOS-only (2026-08-13): cała ścieżka „nativeUpdate" (IPA + AltStore,
 * `fetchNativeRelease`/`buildAltStoreInstallUrl`/`openNativeUpdate`) dotyczy tylko
 * sideloadingu na iOS — zob. `altstoreSource.ts`. Po decyzji o przejściu na
 * Android-only ten kod jest zamrożony, nie rozwijany dalej. `checkForUpdatesOnLaunch`
 * już dziś bailuje na Androidzie (`Platform.OS !== 'ios'`), więc na Androidzie w praktyce
 * uruchamiana jest tylko część OTA (`expo-updates`, wieloplatformowa, bez zmian).
 * Docelowa strategia OTA/EAS Update dla Androida — patrz `TASKS.md` → zadanie I4.
 */

export type NativeReleaseInfo = {
  nativeVersion: string;
  nativeBuildNumber: number;
  ipaUrl: string;
  releaseNotes?: string;
  mandatory?: boolean;
};

export type UpdateCheckResult = {
  /** Aktualizacja JS (expo-updates) — restart wystarczy. */
  otaAvailable: boolean;
  otaManifestId?: string;
  /** Nowa binarka IPA na serwerze — wymaga AltStore. */
  nativeUpdate?: NativeReleaseInfo;
  currentVersion: string;
  currentBuild: string;
  /** Krótki opis aktualnego pakietu JS (nie zmienia numeru 1.0.0). */
  otaBundleLabel: string;
  /** Kanał EAS (production) — null = build nie umie pobierać OTA. */
  otaChannel: string | null;
  otaEnabled: boolean;
  /** Build bez kanału production — trzeba przeinstalować IPA. */
  otaMisconfigured: boolean;
  error?: string;
};

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function getOtaBundleLabel(): string {
  if (!Updates.isEnabled) {
    return __DEV__ ? 'tryb deweloperski' : 'OTA wyłączone';
  }
  const id = Updates.updateId;
  if (!id) return 'pakiet wbudowany w IPA';
  return `pakiet ${id.slice(0, 8)}…`;
}

export async function fetchNativeRelease(): Promise<NativeReleaseInfo | null> {
  try {
    const res = await fetch(`${BASE_URL}/app/release`);
    if (!res.ok) return null;
    const data = (await res.json()) as NativeReleaseInfo;
    if (!data?.nativeVersion || !data?.ipaUrl) return null;
    return data;
  } catch {
    return null;
  }
}

export function buildAltStoreInstallUrl(ipaUrl: string): string {
  return `altstore://install?url=${encodeURIComponent(ipaUrl)}`;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion =
    Application.nativeApplicationVersion ?? APP_VERSION;
  const currentBuild =
    Application.nativeBuildVersion ?? '1';

  const otaEnabled = !__DEV__ && Updates.isEnabled;
  const otaChannel = otaEnabled ? (Updates.channel ?? null) : null;
  const otaMisconfigured = otaEnabled && otaChannel == null;

  const result: UpdateCheckResult = {
    otaAvailable: false,
    currentVersion,
    currentBuild,
    otaBundleLabel: getOtaBundleLabel(),
    otaChannel,
    otaEnabled,
    otaMisconfigured,
  };

  if (otaMisconfigured) {
    result.error =
      'Ta instalacja nie ma skonfigurowanego kanału OTA (production). Zainstaluj ponownie najnowsze IPA z Xcode/AltStore — dopiero wtedy „Sprawdź aktualizacje” pobierze poprawki bez przebudowy całej aplikacji.';
  }

  // OTA (JS) — tylko standalone z expo-updates i poprawnym kanałem
  if (otaEnabled && !otaMisconfigured) {
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        result.otaAvailable = true;
      }
    } catch (e) {
      result.error =
        e instanceof Error ? e.message : 'Błąd sprawdzania OTA';
    }
  }

  const release = await fetchNativeRelease();
  if (release) {
    const versionNewer =
      compareSemver(release.nativeVersion, currentVersion) > 0;
    const buildNewer =
      (release.nativeBuildNumber ?? 0) > (parseInt(currentBuild, 10) || 0);
    if (versionNewer || buildNewer) {
      result.nativeUpdate = release;
    }
  }

  return result;
}

export async function applyOtaUpdate(): Promise<boolean> {
  if (!Updates.isEnabled) return false;
  try {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

export async function openNativeUpdate(release: NativeReleaseInfo): Promise<void> {
  const altUrl = buildAltStoreInstallUrl(release.ipaUrl);

  const tryAltStore = await Linking.canOpenURL(altUrl);
  if (tryAltStore) {
    await Linking.openURL(altUrl);
    return;
  }

  await Linking.openURL(release.ipaUrl);
}

export function formatUpdateMessage(result: UpdateCheckResult): string {
  const lines: string[] = [
    `Wersja natywna (IPA): ${result.currentVersion} (build ${result.currentBuild})`,
    `Aktualny pakiet JS: ${result.otaBundleLabel}`,
  ];

  if (result.otaEnabled) {
    lines.push(
      result.otaChannel
        ? `Kanał OTA: ${result.otaChannel}`
        : 'Kanał OTA: brak — wymagana ponowna instalacja IPA',
    );
  }

  if (result.otaMisconfigured) {
    lines.push(
      '',
      'Poprawki z EAS Update nie trafią na ten telefon, dopóki nie zainstalujesz buildu z kanałem production. To jednorazowa przeinstalacja — potem aktualizacje będą przychodzić bez AltStore co tydzień.',
    );
    return lines.join('\n');
  }

  if (result.otaAvailable) {
    lines.push('', 'Dostępna nowa wersja pakietu JS (bez reinstalacji IPA).');
  }
  if (result.nativeUpdate) {
    lines.push(
      '',
      `Nowa wersja natywna ${result.nativeUpdate.nativeVersion} (build ${result.nativeUpdate.nativeBuildNumber}).`,
    );
    if (result.nativeUpdate.releaseNotes) {
      lines.push(result.nativeUpdate.releaseNotes);
    }
  }

  if (!result.otaAvailable && !result.nativeUpdate) {
    lines.push(
      '',
      'Brak nowszego pakietu JS ani IPA. Numer 1.0.0 to wersja natywna — OTA jej nie zmienia, tylko kod w środku aplikacji.',
    );
  }

  if (result.error && !result.otaMisconfigured) {
    lines.push('', result.error);
  }

  return lines.join('\n');
}

export async function promptAndApplyUpdates(
  result: UpdateCheckResult,
): Promise<void> {
  if (result.otaMisconfigured) {
    Alert.alert('Aktualizacje OTA', formatUpdateMessage(result));
    return;
  }

  if (!result.otaAvailable && !result.nativeUpdate) {
    Alert.alert('Aktualizacje', formatUpdateMessage(result));
    return;
  }

  if (result.otaAvailable && !result.nativeUpdate) {
    Alert.alert('Aktualizacja', formatUpdateMessage(result), [
      { text: 'Później', style: 'cancel' },
      {
        text: 'Pobierz i uruchom',
        onPress: () => {
          void applyOtaUpdate();
        },
      },
    ]);
    return;
  }

  if (result.nativeUpdate && !result.otaAvailable) {
    Alert.alert(
      result.nativeUpdate.mandatory ? 'Wymagana aktualizacja' : 'Nowa wersja',
      formatUpdateMessage(result),
      [
        ...(result.nativeUpdate.mandatory
          ? []
          : [{ text: 'Później', style: 'cancel' as const }]),
        {
          text: 'Otwórz w AltStore',
          onPress: () => {
            void openNativeUpdate(result.nativeUpdate!);
          },
        },
      ],
    );
    return;
  }

  Alert.alert('Aktualizacje', formatUpdateMessage(result), [
    { text: 'Później', style: 'cancel' },
    {
      text: 'Zaktualizuj teraz',
      onPress: () => {
        void applyOtaUpdate();
      },
    },
    ...(result.nativeUpdate
      ? [
          {
            text: 'Wersja natywna (AltStore)',
            onPress: () => {
              void openNativeUpdate(result.nativeUpdate!);
            },
          },
        ]
      : []),
  ]);
}

/** Ciche sprawdzenie przy starcie — tylko gdy coś jest dostępne. */
export async function checkForUpdatesOnLaunch(): Promise<void> {
  if (Platform.OS !== 'ios' || __DEV__) return;
  const result = await checkForUpdates();
  if (result.otaMisconfigured) return;
  if (result.otaAvailable || result.nativeUpdate) {
    await promptAndApplyUpdates(result);
  }
}
