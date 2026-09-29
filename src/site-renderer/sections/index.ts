import type { ComponentType } from 'react';
import type { SectionType } from '@/lib/site/section-schemas';
import { BannerSection } from './BannerSection';
import { CatalogSection } from './CatalogSection';
import { CategoriesSection } from './CategoriesSection';
import { ContactSection } from './ContactSection';
import { FeaturesSection } from './FeaturesSection';
import { GallerySection } from './GallerySection';
import { HeroSection } from './HeroSection';
import { ProductsSection } from './ProductsSection';
import { ServicesSection } from './ServicesSection';
import { SocialSection } from './SocialSection';
import { SpacerSection } from './SpacerSection';
import { TestimonialsSection } from './TestimonialsSection';
import { TextSection } from './TextSection';
import { FaqSection } from './FaqSection';
import { ImageSection } from './ImageSection';
import { LogosSection } from './LogosSection';
import { PricingSection } from './PricingSection';
import { StatsSection } from './StatsSection';
import { TeamSection } from './TeamSection';
import type { SectionProps } from './types';
import { VideoSection } from './VideoSection';

/**
 * Registro de renderers web. TypeScript exige un componente por cada tipo de
 * SECTION_TYPES: agregar una sección nueva sin su renderer no compila.
 */
export const SECTION_COMPONENTS: { [T in SectionType]: ComponentType<SectionProps<T>> } = {
  hero: HeroSection,
  text: TextSection,
  products: ProductsSection,
  services: ServicesSection,
  catalog: CatalogSection,
  categories: CategoriesSection,
  banner: BannerSection,
  gallery: GallerySection,
  features: FeaturesSection,
  testimonials: TestimonialsSection,
  contact: ContactSection,
  social: SocialSection,
  spacer: SpacerSection,
  image: ImageSection,
  video: VideoSection,
  faq: FaqSection,
  pricing: PricingSection,
  team: TeamSection,
  stats: StatsSection,
  logos: LogosSection,
};

export type { SectionProps } from './types';
