import { Placeholder, SectionFrame, SectionHead } from '../SectionFrame';
import { siteTranslator } from '../site-i18n';
import styles from '../site.module.css';
import type { SectionProps } from './types';

/**
 * Tabla accesible (encabezados de columna y, si se pide, de fila). En celular
 * se desliza con la primera columna fija, o cada fila se vuelve una tarjeta
 * (cada dato lleva el nombre de su columna).
 */
export function TableSection({ section, site, env }: SectionProps<'table'>) {
  const { content } = section;
  const t = siteTranslator(site.settings.language);
  const columns = content.columns.filter((column, i) => column.label.trim() || content.rows.some((row) => row.cells[i]?.trim()));
  const rows = content.rows.filter((row) => row.cells.some((cell) => cell.trim()));
  if ((rows.length === 0 || columns.length === 0) && env.mode === 'public') return null;
  const highlight = content.highlight > 0 && content.highlight <= columns.length ? content.highlight - 1 : -1;
  return (
    <SectionFrame section={section} theme={site.theme}>
      <SectionHead eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} center />
      <Placeholder show={rows.length === 0}>{t('Agrega filas a la tabla desde el editor.')}</Placeholder>
      {rows.length > 0 && (
        <div className={styles.tableWrap} data-mobile={content.mobile} role="region" aria-label={content.title || t('Tabla')} tabIndex={0}>
          <table className={styles.table} data-variant={content.variant} data-header={content.header} data-compact={content.compact || undefined} data-row-headers={content.rowHeaders || undefined}>
            {content.title && <caption className={styles.visuallyHidden}>{content.title}</caption>}
            <thead>
              <tr>
                {columns.map((column, i) => (
                  <th key={column.id} scope="col" data-align={column.align} data-highlight={i === highlight || undefined}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column, i) => {
                    const value = row.cells[i] ?? '';
                    const props = { 'data-align': column.align, 'data-label': column.label, 'data-highlight': i === highlight || undefined } as const;
                    return content.rowHeaders && i === 0 ? (
                      <th key={column.id} scope="row" {...props}>{value}</th>
                    ) : (
                      <td key={column.id} {...props}>{value}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {content.note && <p className={styles.tableNote}>{content.note}</p>}
    </SectionFrame>
  );
}
