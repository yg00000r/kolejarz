import type { Express, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { ReleaseManifest } from './appRelease';

/** Minimalny format AltStore Source — https://faq.altstore.io/developers/make-a-source */
export type AltStoreSource = {
  name: string;
  identifier: string;
  sourceURL: string;
  subtitle?: string;
  description?: string;
  apps: Array<{
    name: string;
    bundleIdentifier: string;
    developerName: string;
    subtitle?: string;
    localizedDescription?: string;
    versions: Array<{
      version: string;
      date: string;
      localizedDescription?: string;
      downloadURL: string;
      size: number;
    }>;
  }>;
};

const SOURCE_ID = 'com.ygor.kolejarz.altstore';
const BUNDLE_ID = 'com.ygor.kolejarz';
const APP_NAME = 'Kolejarz';

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function buildAltStoreSource(
  releasesDir: string,
  publicBaseUrl: string,
): Promise<AltStoreSource | null> {
  const base = publicBaseUrl.replace(/\/$/, '');
  const sourceURL = `${base}/altstore/source.json`;

  let manifest: ReleaseManifest;
  try {
    const raw = await fs.readFile(path.join(releasesDir, 'release.json'), 'utf8');
    manifest = JSON.parse(raw) as ReleaseManifest;
  } catch {
    return null;
  }

  const version = manifest.nativeVersion || '1.0.0';
  const fileName = `Kolejarz-${version}.ipa`;
  const ipaPath = path.join(releasesDir, fileName);
  let size = 0;
  let fileDate = isoDateOnly(new Date());

  try {
    const stat = await fs.stat(ipaPath);
    size = stat.size;
    fileDate = isoDateOnly(stat.mtime);
  } catch {
    return null;
  }

  const downloadURL =
    manifest.ipaUrl && manifest.ipaUrl.startsWith('http')
      ? manifest.ipaUrl
      : `${base}/app-releases/${fileName}`;

  return {
    name: APP_NAME,
    identifier: SOURCE_ID,
    sourceURL,
    subtitle: 'Mind / Kolejarz — dyżury, portal, kontrolki',
    description:
      'Prywatne źródło AltStore dla aplikacji Kolejarz. Wymaga odświeżenia certyfikatu przez AltServer co ~7 dni (Personal Team).',
    apps: [
      {
        name: APP_NAME,
        bundleIdentifier: BUNDLE_ID,
        developerName: 'Ygor',
        subtitle: 'Aplikacja kolejowa',
        localizedDescription:
          manifest.releaseNotes ||
          'Grafik, portal IVU, kontrolki szlaków, wydatki. Aktualizacje JS przez OTA w aplikacji.',
        versions: [
          {
            version,
            date: fileDate,
            localizedDescription: manifest.releaseNotes || `Build ${manifest.nativeBuildNumber ?? 1}`,
            downloadURL,
            size,
          },
        ],
      },
    ],
  };
}

export function registerAltStoreSourceRoutes(
  app: Express,
  releasesDir: string,
  publicBaseUrl: string,
): void {
  app.get('/altstore/source.json', async (_req: Request, res: Response) => {
    try {
      const source = await buildAltStoreSource(releasesDir, publicBaseUrl);
      if (!source) {
        return res.status(404).json({
          error: 'Brak release.json lub pliku IPA w app-releases',
        });
      }
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(source);
    } catch (e) {
      res.status(500).json({
        error: 'Nie udało się wygenerować AltStore source',
        detail: String(e),
      });
    }
  });
}
