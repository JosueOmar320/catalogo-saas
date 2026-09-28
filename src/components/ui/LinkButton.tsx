'use client';

import { Button, type ButtonProps } from '@mui/material';
import Link from 'next/link';

type Props = Omit<ButtonProps<typeof Link>, 'component' | 'ref'> & { href: string };

/** Botón MUI con navegación del lado del cliente; usable desde Server Components. */
export function LinkButton(props: Props) {
  return <Button component={Link} {...props} />;
}
