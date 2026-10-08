/**
 * Instagram (official Meta API — "Instagram API with Instagram Login").
 * Requirements (cannot be bypassed): a Meta developer app, an Instagram professional
 * (Business/Creator) account, and an HTTPS redirect URI registered in the app.
 * Data is only fetched when the user clicks "Connect" / "Synchroniser". Nothing is ever published.
 */
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { getSetting, setSetting } from './settings';
import { seal, unseal } from './secrets';
import { prisma } from './db';
import { today } from '../../shared/dates';

const GRAPH = 'https://graph.instagram.com/v21.0';
let pendingState: string | null = null;

export const instagramRouter = Router();

instagramRouter.get('/status', async (_req, res) => {
  const ig = await getSetting('instagram');
  res.json({ configured: !!ig.appId && !!ig.appSecret, connected: !!ig.token, username: ig.username ?? null, redirectUri: ig.redirectUri, lastSync: ig.lastSync ?? null });
});

instagramRouter.post('/config', async (req, res) => {
  const ig = await getSetting('instagram');
  const { appId, appSecret, redirectUri } = req.body ?? {};
  if (appId !== undefined) ig.appId = String(appId).trim();
  if (appSecret) ig.appSecret = seal(String(appSecret).trim());
  if (redirectUri) {
    if (!/^https:\/\//.test(String(redirectUri))) return res.status(400).json({ error: 'Meta exige une URL de redirection HTTPS.' });
    ig.redirectUri = String(redirectUri).trim();
  }
  await setSetting('instagram', ig);
  res.json({ ok: true });
});

instagramRouter.get('/connect', async (_req, res) => {
  const ig = await getSetting('instagram');
  if (!ig.appId || !ig.appSecret) return res.status(400).json({ error: 'Renseignez d’abord l’App ID et l’App Secret Meta dans Settings › Integrations.' });
  pendingState = randomBytes(16).toString('hex');
  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', ig.appId);
  url.searchParams.set('redirect_uri', ig.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_insights');
  url.searchParams.set('state', pendingState);
  res.json({ url: url.toString() });
});

instagramRouter.get('/callback', async (req, res) => {
  try {
    if (!pendingState || req.query.state !== pendingState) return res.status(400).send('État OAuth invalide.');
    pendingState = null;
    const ig = await getSetting('instagram');
    const secret = unseal(ig.appSecret);
    const body = new URLSearchParams({ client_id: ig.appId, client_secret: secret ?? '', grant_type: 'authorization_code', redirect_uri: ig.redirectUri, code: String(req.query.code ?? '') });
    const short = await (await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body })).json();
    if (!short.access_token) throw new Error(short.error_message ?? 'Échange du code refusé');
    const long = await (await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret ?? '')}&access_token=${encodeURIComponent(short.access_token)}`)).json();
    const token = long.access_token ?? short.access_token;
    const me = await (await fetch(`${GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`)).json();
    ig.token = seal(token);
    ig.userId = me.user_id ?? short.user_id;
    ig.username = me.username ?? null;
    ig.connected = true;
    await setSetting('instagram', ig);
    res.redirect('/instagram?connected=1');
  } catch (e) {
    res.status(400).send(`Connexion Instagram impossible : ${(e as Error).message}`);
  }
});

instagramRouter.post('/sync', async (_req, res) => {
  const ig = await getSetting('instagram');
  const token = unseal(ig.token);
  if (!token) return res.status(400).json({ error: 'Compte Instagram non connecté' });
  try {
    const me = await (await fetch(`${GRAPH}/me?fields=user_id,username,followers_count,media_count&access_token=${encodeURIComponent(token)}`)).json();
    if (me.error) throw new Error(me.error.message);
    const insights: Record<string, number> = {};
    const ins = await (await fetch(`${GRAPH}/${me.user_id}/insights?metric=reach,views,total_interactions&period=day&metric_type=total_value&access_token=${encodeURIComponent(token)}`)).json();
    for (const m of ins.data ?? []) insights[m.name] = m.total_value?.value ?? 0;
    const media = await (await fetch(`${GRAPH}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=24&access_token=${encodeURIComponent(token)}`)).json();
    await prisma.socialMetric.create({
      data: { account: 'lash', network: 'instagram', date: today(), followers: me.followers_count ?? null, posts: me.media_count ?? null, reach: insights.reach ?? null, views: insights.views ?? null, interactions: insights.total_interactions ?? null, source: 'api', notes: ins.error ? `Insights indisponibles : ${ins.error.message}` : null },
    });
    ig.lastSync = new Date().toISOString();
    ig.username = me.username ?? ig.username;
    await setSetting('instagram', ig);
    res.json({ ok: true, profile: { username: me.username, followers: me.followers_count, posts: me.media_count }, insights, media: media.data ?? [], insightsError: ins.error?.message ?? null });
  } catch (e) {
    res.status(502).json({ error: `API Meta : ${(e as Error).message}` });
  }
});

instagramRouter.post('/disconnect', async (_req, res) => {
  const ig = await getSetting('instagram');
  delete ig.token;
  ig.connected = false;
  ig.username = null;
  await setSetting('instagram', ig);
  res.json({ ok: true });
});
