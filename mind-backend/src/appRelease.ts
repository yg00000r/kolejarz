import type { Express, Request, Response } from 'express';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

export type ReleaseManifest = {
  nativeVersion: string;
  nativeBuildNumber: number;
  ipaUrl: string;
  releaseNotes?: string;
  mandatory?: boolean;
};

const DEFAULT_RELEASE: ReleaseManifest = {
  nativeVersion: '1.0.0',
  nativeBuildNumber: 1,
  ipaUrl: '',
  releaseNotes: '',
  mandatory: false,
};

export function registerAppReleaseRoutes(
  app: Express,
  releasesDir: string,
  publicBaseUrl: string,
): void {
  fs.mkdir(releasesDir, { recursive: true }).catch(() => {});

  app.use('/app-releases', express.static(releasesDir, { index: false }));

  /** Metadane najnowszej binarki IPA (AltStore). */
  app.get('/app/release', async (_req: Request, res: Response) => {
    try {
      const manifestPath = path.join(releasesDir, 'release.json');
      const raw = await fs.readFile(manifestPath, 'utf8');
      const data = JSON.parse(raw) as ReleaseManifest;

      if (!data.ipaUrl && data.nativeVersion) {
        const fileName = `Kolejarz-${data.nativeVersion}.ipa`;
        data.ipaUrl = `${publicBaseUrl}/app-releases/${fileName}`;
      }

      res.json(data);
    } catch {
      res.json(DEFAULT_RELEASE);
    }
  });

}
