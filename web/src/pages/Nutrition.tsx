import * as React from 'react';
import { Plus, ChevronLeft, ChevronRight, Heart, ShoppingBasket, Check, Trash2, CalendarRange, Copy } from 'lucide-react';
import { today, addDays, formatFr, startOfWeek, eachDay } from '@shared/dates';
import { useList, useInvalidate, useSettings, useSaveSetting, useRemove } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Empty, IconButton, Segmented, Ring, Input, Progress } from '@/components/ui';
import { ResourceTable } from '@/components/resource/ResourceTable';
import { useRecordDialog } from '@/components/resource/RecordDialog';
import { cn, nf, pct } from '@/lib/utils';
import { toast } from 'sonner';

const MEALS = [
  { value: 'breakfast', label: 'Petit-déjeuner', emoji: '🥐' },
  { value: 'lunch', label: 'Déjeuner', emoji: '🥗' },
  { value: 'snack', label: 'Collations', emoji: '🍓' },
  { value: 'dinner', label: 'Dîner', emoji: '🍝' },
];

function Journal() {
  const [day, setDay] = React.useState(today());
  const { data: foods = [] } = useList('foodLog', { where: { date: day } });
  const { data: recipes = [] } = useList('recipe', { where: { favorite: true } });
  const { data: settings } = useSettings();
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const g = settings?.goals ?? {};
  const sum = (k: string) => foods.reduce((s, f) => s + (f[k] ?? 0), 0);
  const macros = [
    { k: 'protein', label: 'Protéines', goal: g.protein ?? 110, color: '#8A3B55' },
    { k: 'carbs', label: 'Glucides', goal: g.carbs ?? 220, color: '#C08A1C' },
    { k: 'fat', label: 'Lipides', goal: g.fat ?? 65, color: '#008F80' },
  ];
  const addFav = async (r: any, meal: string) => {
    await api('/r/foodLog', { body: { date: day, meal, name: r.name, quantity: '1 portion', kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat } });
    invalidate();
    toast.success(`${r.name} ajouté ♡`);
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronLeft} label="Jour précédent" onClick={() => setDay(addDays(day, -1))} />
          <div className="h-display min-w-[200px] text-center text-2xl capitalize">{day === today() ? 'Aujourd’hui' : formatFr(day, { weekday: true })}</div>
          <IconButton icon={ChevronRight} label="Jour suivant" onClick={() => setDay(addDays(day, 1))} />
        </div>
        {MEALS.map((m) => {
          const items = foods.filter((f) => f.meal === m.value);
          return (
            <Card key={m.value}>
              <CardHeader title={`${m.emoji} ${m.label}`} eyebrow={items.length ? `${nf(items.reduce((s, f) => s + (f.kcal ?? 0), 0))} kcal` : undefined} action={<Button size="sm" variant="soft" icon={Plus} onClick={() => open({ resource: 'foodLog', defaults: { date: day, meal: m.value } })}>Aliment</Button>} />
              <div className="p-3">
                {items.length === 0 ? <div className="px-3 py-2 text-xs text-muted">Rien de noté</div> : items.map((f) => (
                  <button key={f.id} onClick={() => open({ resource: 'foodLog', id: f.id })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-sunken">
                    <span className="flex-1 truncate font-medium">{f.name} <span className="font-normal text-muted">{f.quantity}</span></span>
                    <span className="num text-xs text-muted">P {nf(f.protein)} · G {nf(f.carbs)} · L {nf(f.fat)}</span>
                    <span className="num w-16 text-right font-semibold">{nf(f.kcal)} kcal</span>
                  </button>
                ))}
                {recipes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 px-2">
                    {recipes.slice(0, 6).map((r) => (
                      <button key={r.id} onClick={() => addFav(r, m.value)} className="chip py-1"><Heart className="h-3 w-3" />{r.name}</button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <div className="space-y-4">
        <Card className="p-5">
          <div className="eyebrow mb-4">Bilan du jour (estimations)</div>
          <div className="flex items-center gap-5">
            <Ring value={pct(sum('kcal'), g.kcal ?? 2000)} size={110} stroke={8}>
              <div className="text-center"><div className="num font-display text-2xl">{nf(sum('kcal'))}</div><div className="text-[10px] text-muted">/ {g.kcal ?? 2000} kcal</div></div>
            </Ring>
            <div className="flex-1 space-y-3">
              {macros.map((m) => (
                <div key={m.k}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{m.label}</span><span className="num font-medium">{nf(sum(m.k))} / {m.goal} g</span></div>
                  <Progress value={pct(sum(m.k), m.goal)} color={m.color} height={5} />
                </div>
              ))}
            </div>
          </div>
        </Card>
        <GoalsCard />
      </div>
    </div>
  );
}

function GoalsCard() {
  const { data: settings } = useSettings();
  const save = useSaveSetting();
  const g = settings?.goals ?? {};
  const field = (k: string, label: string, unit: string) => (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-1"><Input type="number" className="w-24 py-1.5" defaultValue={g[k]} onBlur={(e) => save.mutate({ key: 'goals', value: { ...g, [k]: Number(e.target.value) || null } })} /><span className="w-8 text-xs text-muted">{unit}</span></span>
    </label>
  );
  return (
    <Card className="space-y-2 p-5">
      <div className="eyebrow mb-2">Mes objectifs (personnalisables)</div>
      {field('kcal', 'Calories', 'kcal')}
      {field('protein', 'Protéines', 'g')}
      {field('carbs', 'Glucides', 'g')}
      {field('fat', 'Lipides', 'g')}
      <p className="pt-1 text-[11px] text-muted">Repères personnels, pas un avis médical.</p>
    </Card>
  );
}

function Shopping() {
  const { data: items = [] } = useList('shoppingItem');
  const invalidate = useInvalidate();
  const remove = useRemove('shoppingItem');
  const [draft, setDraft] = React.useState('');
  const add = async () => {
    if (!draft.trim()) return;
    await api('/r/shoppingItem', { body: { name: draft.trim(), checked: false } });
    setDraft('');
    invalidate();
  };
  const clearChecked = async () => {
    for (const i of items.filter((x) => x.checked)) await api(`/r/shoppingItem/${i.id}`, { method: 'DELETE' });
    invalidate();
  };
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader icon={ShoppingBasket} title="Liste de courses" action={items.some((i) => i.checked) ? <Button size="sm" variant="ghost" onClick={clearChecked}>Vider les articles pris</Button> : undefined} />
      <div className="p-4">
        <div className="mb-3 flex gap-2"><Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Ajouter un article… (Entrée)" /><Button icon={Plus} onClick={add}>Ajouter</Button></div>
        {items.length === 0 && <Empty title="Liste vide" className="py-6" />}
        {[...items].sort((a, b) => Number(a.checked) - Number(b.checked)).map((i) => (
          <div key={i.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sunken">
            <button onClick={async () => { await api(`/r/shoppingItem/${i.id}`, { method: 'PATCH', body: { checked: !i.checked } }); invalidate(); }} className={cn('grid h-5 w-5 place-items-center rounded-md border', i.checked ? 'border-wine bg-wine text-onwine' : 'border-line')}>{i.checked && <Check className="h-3 w-3" />}</button>
            <span className={cn('flex-1 text-sm', i.checked && 'text-muted line-through')}>{i.name} {i.quantity && <span className="text-muted">· {i.quantity}</span>}</span>
            <button onClick={() => remove.mutate(i.id)} className="opacity-0 group-hover:opacity-100" aria-label="Supprimer"><Trash2 className="h-4 w-4 text-muted" /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Planning() {
  const [wk, setWk] = React.useState(startOfWeek(today()));
  const days = eachDay(wk, addDays(wk, 6));
  const { data: plans = [] } = useList('mealPlan', { where: { date: { gte: wk, lte: addDays(wk, 6) } } });
  const open = useRecordDialog();
  const invalidate = useInvalidate();
  const copyToShopping = async () => {
    const { data } = { data: plans };
    const recipesIds = data.filter((p) => p.recipeId).map((p) => p.recipeId);
    if (!recipesIds.length) return toast('Associe des recettes au planning pour générer la liste.');
    const recipes = await api<any[]>(`/r/recipe?where=${encodeURIComponent(JSON.stringify({ id: { in: recipesIds } }))}`);
    let n = 0;
    for (const r of recipes) for (const line of String(r.ingredients ?? '').split('\n').map((s) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)) { await api('/r/shoppingItem', { body: { name: line, checked: false } }); n++; }
    invalidate();
    toast.success(`${n} ingrédients ajoutés à la liste de courses`);
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <IconButton icon={ChevronLeft} label="Semaine précédente" onClick={() => setWk(addDays(wk, -7))} />
        <div className="h-display text-xl">Semaine du {formatFr(wk)}</div>
        <IconButton icon={ChevronRight} label="Semaine suivante" onClick={() => setWk(addDays(wk, 7))} />
        <Button size="sm" variant="soft" icon={Copy} className="ml-auto" onClick={copyToShopping}>Générer la liste de courses</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => (
          <Card key={d} className={cn('p-3', d === today() && 'ring-2 ring-wine/20')}>
            <div className="mb-2 text-sm font-semibold capitalize">{formatFr(d, { weekday: true }).split(' ').slice(0, 2).join(' ')}</div>
            {MEALS.map((m) => {
              const p = plans.filter((x) => x.date === d && x.meal === m.value);
              return (
                <div key={m.value} className="mb-1.5">
                  {p.map((x) => <button key={x.id} onClick={() => open({ resource: 'mealPlan', id: x.id })} className="mb-1 block w-full truncate rounded-lg bg-petal/70 px-2 py-1 text-left text-[11px]">{m.emoji} {x.label}</button>)}
                  {!p.length && <button onClick={() => open({ resource: 'mealPlan', defaults: { date: d, meal: m.value } })} className="block w-full rounded-lg border border-dashed border-line px-2 py-1 text-left text-[10px] text-muted hover:border-wine/30">+ {m.label}</button>}
                </div>
              );
            })}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function NutritionPage() {
  const [tab, setTab] = React.useState<'journal' | 'recipes' | 'planning' | 'shopping'>('journal');
  return (
    <Page>
      <PageHeader eyebrow="Wellness" title="Nutrition" accent="& energy" subtitle="Journal alimentaire, repas favoris, recettes, planning et courses." coverKey="nutrition" variant={1} compact />
      <Segmented className="mb-5" value={tab} onChange={setTab} options={[{ value: 'journal', label: 'Journal' }, { value: 'recipes', label: 'Recettes & favoris', icon: Heart }, { value: 'planning', label: 'Planning', icon: CalendarRange }, { value: 'shopping', label: 'Courses', icon: ShoppingBasket }]} />
      {tab === 'journal' && <Journal />}
      {tab === 'recipes' && <ResourceTable resource="recipe" title="Recettes & repas favoris" />}
      {tab === 'planning' && <Planning />}
      {tab === 'shopping' && <Shopping />}
    </Page>
  );
}
