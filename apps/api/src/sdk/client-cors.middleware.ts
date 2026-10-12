import type { NextFunction, Request, Response } from 'express';

/**
 * Browser SDKs call `/sdk/client/*` from customers' own sites, so any origin is allowed.
 * That's safe because these routes use a public client key, never cookies, and only
 * return evaluated results. Every other route keeps the default same-origin policy.
 */
export function clientCors(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}
