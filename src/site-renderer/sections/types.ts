import type { LinkContext } from '@/lib/site/links';
import type { SectionOf, SectionType } from '@/lib/site/section-schemas';
import type { SiteViewModel } from '@/lib/site/view-model';
import type { RenderEnv } from '../env';

export type SectionProps<T extends SectionType> = {
  section: SectionOf<T>;
  site: SiteViewModel;
  env: RenderEnv;
  links: LinkContext;
  /** Posición en la página (la primera puede priorizar su imagen: LCP). */
  index: number;
};
