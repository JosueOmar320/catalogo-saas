'use client';

import { Star } from 'lucide-react';
import { useId, useState } from 'react';
import { useSiteT } from './SiteI18n';
import styles from './site.module.css';

type State = 'idle' | 'sending' | 'sent' | 'error';

/**
 * "Deja tu opinión": estrellas, nombre y comentario. Llega al negocio como
 * pendiente y se publica cuando la aprueba. En la demo no se envía.
 */
export function ReviewForm({ slug, item, demo, startOpen = false }: { slug: string; item: string | null; demo?: boolean; startOpen?: boolean }) {
  const t = useSiteT();
  const id = useId();
  const [open, setOpen] = useState(startOpen);
  const [rating, setRating] = useState(0);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<State>('idle');

  if (state === 'sent') {
    return <p className={styles.reviewThanks} role="status">{t('¡Gracias! Tu opinión se publicará cuando el negocio la apruebe.')}</p>;
  }
  if (!open) {
    return (
      <button type="button" className={styles.linkButton} onClick={() => setOpen(true)}>
        {t('Deja tu opinión')}
      </button>
    );
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rating || !name.trim()) return;
    if (demo) return setState('sent');
    setState('sending');
    const website = (new FormData(event.currentTarget).get('website') as string) ?? '';
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, item, name: name.trim(), rating, body: body.trim(), website }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      setState(response.ok && result?.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <form className={styles.reviewForm} onSubmit={(event) => void submit(event)}>
      <fieldset className={styles.reviewStars}>
        <legend>{t('Tu calificación')}</legend>
        {[1, 2, 3, 4, 5].map((value) => (
          <label key={value} title={t('{rating} de 5 estrellas', { rating: value })}>
            <input type="radio" name={`${id}-rating`} value={value} checked={rating === value} onChange={() => setRating(value)} />
            <Star size={26} fill={value <= rating ? 'currentColor' : 'none'} aria-hidden />
            <span className={styles.visuallyHidden}>{t('{rating} de 5 estrellas', { rating: value })}</span>
          </label>
        ))}
      </fieldset>
      <label>
        <span>{t('Tu nombre')}</span>
        <input type="text" value={name} maxLength={60} required autoComplete="given-name" onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        <span>{t('Comentario (opcional)')}</span>
        <textarea rows={3} value={body} maxLength={600} onChange={(event) => setBody(event.target.value)} />
      </label>
      {/* Trampa para robots: oculta para las personas y para los lectores de pantalla. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className={styles.honeypot} />
      {state === 'error' && <p className={styles.orderCouponError} role="alert">{t('No se pudo enviar tu opinión. Intenta de nuevo más tarde.')}</p>}
      <button type="submit" className={styles.btn} data-variant="solid" disabled={state === 'sending' || !rating || !name.trim()}>
        {state === 'sending' ? t('Enviando…') : t('Enviar opinión')}
      </button>
    </form>
  );
}
