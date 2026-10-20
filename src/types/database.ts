/**
 * Tipos de la base de datos en el formato de `supabase gen types typescript`.
 * Mantener sincronizado con supabase/migrations. Para regenerarlos desde un
 * proyecto real: `npm run db:types` (requiere Supabase CLI y SUPABASE_PROJECT_ID).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type BusinessRow = Timestamps & {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slogan: string | null;
  logo_path: string | null;
  plan_id: string;
  contact: Json;
  social_links: Json;
  created_by: string | null;
  status: BusinessStatus;
  deleted_at: string | null;
};

type CatalogRow = Timestamps & {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  status: CatalogStatus;
  is_default: boolean;
  is_active: boolean;
  theme: Json;
  settings: Json;
  seo: Json;
  navigation: Json;
  pdf: Json;
  attribute_defs: Json;
  cover_path: string | null;
  favicon_path: string | null;
  published_at: string | null;
  deleted_at: string | null;
};

type CategoryRow = Timestamps & {
  id: string;
  business_id: string;
  catalog_id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  position: number;
  is_active: boolean;
  deleted_at: string | null;
};

type CatalogItemRow = Timestamps & {
  id: string;
  business_id: string;
  catalog_id: string;
  category_id: string | null;
  type: ItemType;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  price: number | null;
  compare_at_price: number | null;
  currency: string;
  price_note: string | null;
  sku: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_visible: boolean;
  position: number;
  tags: string[];
  attributes: Json;
  deleted_at: string | null;
};

type CatalogItemImageRow = Timestamps & {
  id: string;
  business_id: string;
  item_id: string;
  storage_path: string;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  mime_type: string | null;
  alt: string | null;
  position: number;
};

type CatalogPageRow = Timestamps & {
  id: string;
  business_id: string;
  catalog_id: string;
  title: string;
  slug: string;
  template: string;
  is_home: boolean;
  is_published: boolean;
  position: number;
  sections: Json;
  style: Json;
  seo: Json;
  deleted_at: string | null;
};

type PlanRow = Timestamps & {
  id: string;
  name: string;
  sort_order: number;
  limits: Json;
  features: Json;
  is_public: boolean;
};

type ProfileRow = Timestamps & {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  platform_role: PlatformRole;
  status: UserStatus;
  last_login_at: string | null;
  /** Idioma preferido de la app (es | en); null = el del navegador. */
  locale: string | null;
  /** Recibe el aviso semanal de pendientes del catálogo (activado por defecto). */
  notify_catalog_review: boolean;
  max_businesses: number | null;
  created_by: string | null;
};

type AuditLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  business_id: string | null;
  metadata: Json;
  created_at: string;
};

type MediaAssetRow = Timestamps & {
  id: string;
  business_id: string;
  path: string;
  thumb_path: string | null;
  kind: string;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  alt: string;
  tags: string[];
  source: MediaSource;
  source_url: string | null;
  attribution: string | null;
  created_by: string | null;
  deleted_at: string | null;
  name: string;
  original_name: string | null;
  folder: MediaFolder;
  storage_provider: StorageProviderId;
  public_url: string | null;
};

type BusinessMemberRow = Timestamps & {
  business_id: string;
  user_id: string;
  role: MemberRole;
};

/** Reseña de un cliente (pendiente hasta que el negocio la aprueba). */
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
type ReviewRow = { id: string; business_id: string; item_id: string | null; name: string; rating: number; body: string; status: ReviewStatus; created_at: string; reviewed_at: string | null };

/** Páginas vistas del sitio publicado (contadores por día UTC; los escribe record_view). */
type SiteViewStatsDailyRow = { business_id: string; day: string; views: number };
/** Fichas de producto o servicio vistas (por día UTC). */
type ItemViewStatsDailyRow = { business_id: string; day: string; item_id: string; views: number };
/** Costo de un producto (privado: sólo los miembros del negocio; no va al catálogo público). */
type ItemCostRow = { item_id: string; business_id: string; cost: number; updated_at: string };
/** Secciones que el negocio guardó como plantilla en el editor (máx. 50). */
type SectionTemplateRow = { id: string; business_id: string; name: string; section: Json; created_at: string };
/** Búsquedas sin resultados del sitio publicado (término en minúsculas, por día UTC; las escribe record_search_miss). */
type SearchMissStatsDailyRow = { business_id: string; day: string; term: string; searches: number };

/** Pedidos por WhatsApp enviados (contadores por día UTC; los escribe record_order). */
type OrderStatsDailyRow = {
  business_id: string;
  day: string;
  orders: number;
  units: number;
  /** numeric: PostgREST lo devuelve como número. */
  value: number;
};

type OrderItemStatsDailyRow = {
  business_id: string;
  day: string;
  item_id: string;
  orders: number;
  units: number;
};

/** Avisos por correo enviados (sólo los usa el servidor con la service role). */
type NotificationLogRow = {
  id: number;
  user_id: string;
  business_id: string;
  kind: 'catalog_review';
  sent_at: string;
};

/** Inserción: columnas con default son opcionales. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: InsertOf<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type CatalogStatus = 'draft' | 'published' | 'unpublished';
export type ItemType = 'product' | 'service';
export type MemberRole = 'owner' | 'admin' | 'editor';
export type PlatformRole = 'admin' | 'user';
export type UserStatus = 'active' | 'disabled';
export type BusinessStatus = 'active' | 'suspended';
export type MediaSource = 'upload' | 'import' | 'stock' | 'chat';
export type MediaFolder = 'images' | 'logos' | 'products' | 'backgrounds' | 'banners' | 'other';
export type StorageProviderId = 'supabase' | 'external';

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' };
  public: {
    Tables: {
      plans: Table<PlanRow, 'id' | 'name'>;
      profiles: Table<ProfileRow, 'id'>;
      businesses: Table<BusinessRow, 'name' | 'slug'>;
      business_members: Table<BusinessMemberRow, 'business_id' | 'user_id'>;
      catalogs: Table<CatalogRow, 'business_id' | 'name' | 'slug'>;
      categories: Table<CategoryRow, 'business_id' | 'catalog_id' | 'name'>;
      catalog_items: Table<CatalogItemRow, 'business_id' | 'catalog_id' | 'name' | 'slug'>;
      catalog_item_images: Table<CatalogItemImageRow, 'business_id' | 'item_id' | 'storage_path'>;
      catalog_pages: Table<CatalogPageRow, 'business_id' | 'catalog_id' | 'title' | 'slug'>;
      audit_log: Table<AuditLogRow, 'action' | 'entity_type'>;
      media_assets: Table<MediaAssetRow, 'business_id' | 'path'>;
      order_stats_daily: Table<OrderStatsDailyRow, 'business_id' | 'day'>;
      order_item_stats_daily: Table<OrderItemStatsDailyRow, 'business_id' | 'day' | 'item_id'>;
      site_view_stats_daily: Table<SiteViewStatsDailyRow, 'business_id' | 'day'>;
      reviews: Table<ReviewRow, 'business_id' | 'name' | 'rating'>;
      item_view_stats_daily: Table<ItemViewStatsDailyRow, 'business_id' | 'day' | 'item_id'>;
      search_miss_stats_daily: Table<SearchMissStatsDailyRow, 'business_id' | 'day' | 'term'>;
      item_costs: Table<ItemCostRow, 'item_id' | 'business_id' | 'cost'>;
      section_templates: Table<SectionTemplateRow, 'business_id' | 'name' | 'section'>;
      notification_log: Table<NotificationLogRow, 'user_id' | 'business_id' | 'kind'>;
    };
    Views: { [_ in never]: never };
    Functions: {
      create_business: {
        Args: {
          p_name: string;
          p_slug: string;
          p_contact?: Json;
          p_catalog_theme?: Json;
          p_catalog_settings?: Json;
        };
        Returns: string;
      };
      is_business_slug_available: { Args: { p_slug: string }; Returns: boolean };
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      admin_create_business: {
        Args: { p_name: string; p_slug: string; p_owner?: string | null; p_plan_id?: string; p_contact?: Json; p_catalog_theme?: Json; p_catalog_settings?: Json };
        Returns: string;
      };
      admin_update_business: { Args: { p_business: string; p_name: string; p_slug: string; p_plan_id: string; p_status: BusinessStatus }; Returns: undefined };
      admin_set_business_member: { Args: { p_business: string; p_user: string; p_role: MemberRole }; Returns: undefined };
      admin_remove_business_member: { Args: { p_business: string; p_user: string }; Returns: undefined };
      admin_update_profile: {
        Args: { p_user: string; p_full_name: string; p_email: string | null; p_role: PlatformRole; p_status: UserStatus; p_max_businesses: number | null };
        Returns: undefined;
      };
      admin_create_catalog: { Args: { p_business: string; p_name: string }; Returns: string };
      admin_update_catalog: { Args: { p_catalog: string; p_name: string; p_is_active: boolean; p_make_default: boolean }; Returns: undefined };
      log_audit: { Args: { p_action: string; p_entity_type: string; p_entity_id: string | null; p_business_id?: string | null; p_metadata?: Json }; Returns: undefined };
      reorder_rows: {
        Args: { p_table: 'categories' | 'catalog_items' | 'catalog_item_images'; p_ids: string[] };
        Returns: undefined;
      };
      get_public_catalog: { Args: { p_business_slug: string }; Returns: Json };
      admin_catalog_counts: { Args: Record<string, never>; Returns: { catalog_id: string; pages: number; items: number }[] };
      admin_stats: { Args: Record<string, never>; Returns: Json };
      rate_limit_consume: { Args: { p_key: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      record_order: { Args: { p_business_slug: string; p_items: { id: string; qty: number }[] }; Returns: boolean };
      record_view: { Args: { p_business_slug: string; p_item_slug?: string | null }; Returns: boolean };
      record_search_miss: { Args: { p_business_slug: string; p_term: string }; Returns: boolean };
      submit_review: { Args: { p_business_slug: string; p_item_slug: string | null; p_name: string; p_rating: number; p_body: string }; Returns: boolean };
      get_public_reviews: { Args: { p_business_slug: string }; Returns: { id: string; item_id: string | null; name: string; rating: number; body: string; created_at: string }[] };
      media_references: { Args: { p_business: string; p_path: string }; Returns: { place: string; ref_id: string; label: string }[] };
      replace_media_references: { Args: { p_business: string; p_old: string; p_new: string; p_new_thumb?: string | null }; Returns: number };
      save_site: {
        Args: {
          p_catalog_id: string;
          p_theme?: Json | null;
          p_navigation?: Json | null;
          p_pages?: Json | null;
          p_deleted_page_ids?: string[];
        };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database['public']['Tables'];
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update'];
