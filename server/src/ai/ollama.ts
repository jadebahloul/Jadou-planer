/** Ollama (local LLM) client — data never leaves the computer. */
import { getSetting } from '../settings';
import { REGISTRY, type ResourceDef } from '../../../shared/registry';
import type { AiAction } from './local';

export async function ollamaStatus() {
  const ai = await getSetting('ai');
  if (!ai.enabled) return { enabled: false, available: false, models: [] as string[] };
  if (!isLocalUrl(ai.url)) return { enabled: true, available: false, models: [], error: 'Seules les adresses locales (localhost / 127.0.0.1) sont autorisées pour Ollama.' };
  try {
    const r = await fetch(`${ai.url.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(1500) });
    const j = await r.json();
    const models = (j.models ?? []).map((m: { name: string }) => m.name);
    return { enabled: true, available: true, models, model: ai.model, modelInstalled: models.includes(ai.model) };
  } catch {
    return { enabled: true, available: false, models: [], model: ai.model };
  }
}

export function isLocalUrl(url: string) {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

const ACTIONABLE = ['task', 'event', 'goal', 'transaction', 'wishlistItem', 'lashAppointment', 'client', 'workoutSession', 'homework', 'exam', 'contentPost', 'note', 'memory', 'businessIdea', 'trip', 'savingsGoal', 'habit', 'resource', 'beautyProduct', 'mealPlan', 'shoppingItem'] as const;

function schemaDoc() {
  return ACTIONABLE.map((name) => {
    const def = (REGISTRY as Record<string, ResourceDef>)[name];
    const fields = Object.entries(def.fields)
      .filter(([, f]) => !f.hidden || f.type === 'json')
      .map(([k, f]) => `${k}${f.required ? '*' : ''}:${f.type === 'enum' ? (f.options ?? []).map((o) => o.value).join('|') : f.type === 'ref' ? `id(${f.ref})` : f.type}`)
      .join(', ');
    return `- ${name} (${def.label}): ${fields}`;
  }).join('\n');
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['create', 'update'] },
          resource: { type: 'string', enum: [...ACTIONABLE] },
          id: { type: 'integer' },
          data: { type: 'object' },
          summary: { type: 'string' },
          hints: { type: 'object' },
        },
        required: ['op', 'resource', 'data', 'summary'],
      },
    },
  },
  required: ['reply', 'actions'],
};

export async function ollamaChat(message: string, history: { role: string; content: string }[], context: unknown): Promise<{ reply: string; actions: AiAction[] }> {
  const ai = await getSetting('ai');
  const system = `Tu es Jadou AI, l'assistante personnelle de Jade (Jadou), intégrée à son application Jadou Planner. Tu réponds en français, avec chaleur, concision et élégance (tutoiement, émojis discrets ♡).

RÈGLES ABSOLUES
- Tu n'inventes JAMAIS de chiffres ni d'informations : utilise uniquement le CONTEXTE ci-dessous (données réelles). Si une info manque, dis-le simplement.
- Tu ne modifies rien toi-même : tu PROPOSES des actions dans "actions". Jade les confirme une par une avant enregistrement.
- Aucune publication sur les réseaux sociaux, aucun envoi externe.
- Dates au format YYYY-MM-DD, date+heure au format YYYY-MM-DDTHH:mm, heures HH:mm. Aujourd'hui = ${(context as { today: string }).today}.
- Pour un rendez-vous cils avec une cliente nommée, mets hints.clientName (et hints.serviceName si connue) au lieu de clientId.
- N'utilise que les ressources et champs listés. Réponds STRICTEMENT en JSON {"reply": string, "actions": [...]}.

RESSOURCES DISPONIBLES (champ* = obligatoire)
${schemaDoc()}

CONTEXTE (données réelles de Jade)
${JSON.stringify(context)}`;
  const r = await fetch(`${ai.url.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ai.model,
      stream: false,
      format: RESPONSE_SCHEMA,
      options: { temperature: 0.4 },
      messages: [{ role: 'system', content: system }, ...history.slice(-10), { role: 'user', content: message }],
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const raw = j.message?.content ?? '';
  try {
    const parsed = JSON.parse(raw);
    return { reply: String(parsed.reply ?? ''), actions: Array.isArray(parsed.actions) ? parsed.actions : [] };
  } catch {
    return { reply: raw, actions: [] };
  }
}
