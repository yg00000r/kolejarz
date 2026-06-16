/**
 * Middleware autoryzacji dla endpointów wymagających sesji aplikacji.
 *
 * Pobiera token Bearer z nagłówka Authorization, weryfikuje go w tabeli AppSession
 * i dołącza tenantId + portalUsername do obiektu request.
 *
 * Endpointy publiczne (nie wymagają tego middleware):
 *   GET /health, GET /portal/health, POST /auth/register, POST /auth/verify-portal
 */

import { type Request, type Response, type NextFunction } from 'express';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from './generated/prisma/client';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

export interface AuthRequest extends Request {
  tenantId?: number;
  portalUsername?: string;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Brak tokenu autoryzacji. Zaloguj się ponownie w aplikacji.' });
    return;
  }

  try {
    const session = await prisma.appSession.findUnique({
      where: { token },
      include: { tenant: true },
    });

    if (!session) {
      res.status(401).json({ error: 'Nieznana sesja. Zaloguj się ponownie.' });
      return;
    }

    if (session.expiresAt < new Date()) {
      await prisma.appSession.delete({ where: { id: session.id } });
      res.status(401).json({ error: 'Sesja wygasła. Zaloguj się ponownie.' });
      return;
    }

    req.tenantId = session.tenantId;
    req.portalUsername = session.tenant.portalUsername;
    next();
  } catch (e) {
    console.error('[Auth] Session lookup failed:', e);
    res.status(500).json({ error: 'Błąd weryfikacji sesji' });
  }
}
