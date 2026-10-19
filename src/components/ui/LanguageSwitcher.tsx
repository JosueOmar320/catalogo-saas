'use client';

import { IconButton, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { Check, Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setLocale } from '@/i18n/actions';
import { useLocale, useT } from '@/i18n/client';
import { LOCALE_LABELS, LOCALES } from '@/i18n/config';

/** Selector de idioma de la app (se guarda en cookie y en el perfil). */
export function LanguageSwitcher() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Tooltip title={t('Idioma')}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} disabled={pending} aria-label={t('Cambiar idioma')} aria-haspopup="menu" aria-expanded={Boolean(anchor)}>
          <Languages size={17} />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {LOCALES.map((option) => (
          <MenuItem
            key={option}
            selected={option === locale}
            lang={option}
            onClick={() => {
              setAnchor(null);
              if (option === locale) return;
              startTransition(async () => {
                await setLocale(option);
                router.refresh();
              });
            }}
          >
            <ListItemText>{LOCALE_LABELS[option]}</ListItemText>
            {option === locale && <Check size={15} style={{ marginLeft: 12 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
