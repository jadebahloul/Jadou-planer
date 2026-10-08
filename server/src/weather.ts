// Optional weather via Open-Meteo (no account, no personal data sent besides the city coordinates). Off by default.
import { Router } from 'express';
import { getSetting, setSetting } from './settings';

let cache: { at: number; key: string; data: unknown } | null = null;
export const weatherRouter = Router();

weatherRouter.get('/', async (_req, res) => {
  const w = await getSetting('weather');
  if (!w.enabled) return res.json({ enabled: false });
  const key = `${w.lat},${w.lon}`;
  if (cache && cache.key === key && Date.now() - cache.at < 30 * 60000) return res.json(cache.data);
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`);
    const j = await r.json();
    const data = { enabled: true, city: w.city, temp: Math.round(j.current?.temperature_2m), code: j.current?.weather_code, max: Math.round(j.daily?.temperature_2m_max?.[0]), min: Math.round(j.daily?.temperature_2m_min?.[0]) };
    cache = { at: Date.now(), key, data };
    res.json(data);
  } catch {
    res.json({ enabled: true, error: 'Météo indisponible (pas de connexion ?)' });
  }
});

weatherRouter.post('/city', async (req, res) => {
  const city = String(req.body?.city ?? '').trim();
  try {
    const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr`)).json();
    const g = j.results?.[0];
    if (!g) return res.status(404).json({ error: 'Ville introuvable' });
    const w = await getSetting('weather');
    await setSetting('weather', { ...w, city: g.name, lat: g.latitude, lon: g.longitude });
    cache = null;
    res.json({ city: g.name });
  } catch {
    res.status(502).json({ error: 'Service météo injoignable' });
  }
});
