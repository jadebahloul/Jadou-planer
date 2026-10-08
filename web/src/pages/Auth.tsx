import * as React from 'react';
import { Heart, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { CoverArt } from '@/components/layout/PageHeader';

export function AuthScreen({ configured, onDone }: { configured: boolean; onDone: () => void }) {
  const [name, setName] = React.useState('Jade');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!configured && pw !== pw2) return setErr('Les mots de passe ne correspondent pas');
    setBusy(true);
    try {
      await api(configured ? '/auth/login' : '/auth/setup', { body: { name, password: pw } });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="relative grid min-h-full place-items-center p-4">
      <CoverArt variant={0} />
      <form onSubmit={submit} className="card relative w-full max-w-md animate-fade-up p-8 sm:p-10">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-wine text-onwine shadow-lift">
          <span className="font-display text-3xl italic">J</span>
        </div>
        <h1 className="h-display text-center text-4xl">
          Jadou <em className="text-wine">Planner</em>
        </h1>
        <p className="mt-1 text-center text-sm text-muted">Your life, beautifully organized ♡</p>
        <div className="mt-8 space-y-3">
          {!configured && (
            <>
              <p className="rounded-2xl bg-petal/60 p-3 text-xs text-ink/80">
                Bienvenue ! Choisis un mot de passe local : il protège tes données sur cet ordinateur. Rien n’est envoyé sur Internet.
              </p>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" />
            </>
          )}
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input autoFocus type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe" className="pl-10" autoComplete={configured ? 'current-password' : 'new-password'} />
          </div>
          {!configured && <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirmer le mot de passe" autoComplete="new-password" />}
          {err && <p className="text-sm text-bad">{err}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            {configured ? 'Ouvrir mon planner' : 'Créer mon espace'} <Heart className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
