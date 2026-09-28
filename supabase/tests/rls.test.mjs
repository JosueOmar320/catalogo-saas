/**
 * Pruebas de aislamiento multi-tenant (RLS, FKs compuestas, Storage, límites).
 * Corre las migraciones en PGlite (Postgres en WASM) con stubs mínimos de los
 * esquemas auth/storage de Supabase. No requiere Docker: `npm run test:db`.
 */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8'));
const db = new PGlite();
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create schema storage;
create table storage.buckets(id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
alter default privileges in schema public grant all on tables to anon, authenticated;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
`);
// 1) Esquema v1 + un catálogo "legado" (tema v1, portada) creado antes de la v2.
await db.exec(migrations[0]);
const LEGACY_BIZ = 'cccccccc-0000-4000-8000-000000000003';
await db.exec(`
insert into auth.users(id, raw_user_meta_data) values
 ('aaaaaaaa-0000-4000-8000-000000000001','{"full_name":"Ana"}'),
 ('bbbbbbbb-0000-4000-8000-000000000002','{}');
insert into public.businesses(id, name, slug, description) values ('${LEGACY_BIZ}', 'Legado', 'legado', 'Tienda antigua');
insert into public.catalogs(business_id, name, slug, is_default, status, cover_path, theme)
values ('${LEGACY_BIZ}', 'Legado', 'principal', true, 'published', '${LEGACY_BIZ}/cover/x.jpg',
  '{"version":1,"layout":{"variant":"list","columns":2},"sections":{"showSearch":false},"header":{"style":"cover","showMenu":true}}');
`);
// 2) Migraciones siguientes (v2 en adelante), que deben migrar el catálogo legado.
for (const sql of migrations.slice(1)) await db.exec(sql);
await db.exec(`
grant usage on schema public, auth, storage to anon, authenticated;
grant all on all tables in schema storage to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
`);
const A='aaaaaaaa-0000-4000-8000-000000000001', B='bbbbbbbb-0000-4000-8000-000000000002';
let pass=0, fail=0;
const as = async (user) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user??''}', false); set role ${user?'authenticated':'anon'};`); };
const q = async (sql, params) => (await db.query(sql, params)).rows;
const expectOk = async (name, fn) => { try { const r = await fn(); console.log('✔', name, r!==undefined? JSON.stringify(r).slice(0,160):''); pass++; } catch(e){ console.log('✘', name, e.message); fail++; } };
const expectErr = async (name, fn, match) => { try { const r = await fn(); console.log('✘ (no error)', name, JSON.stringify(r)); fail++; } catch(e){ const ok = !match || e.message.includes(match); console.log(ok?'✔':'✘', name, '→', e.message); if (ok) pass++; else fail++; } };
const expectEq = async (name, fn, expected) => { try { const r = await fn(); const ok = JSON.stringify(r)===JSON.stringify(expected); console.log(ok?'✔':'✘', name, JSON.stringify(r)); if (ok) pass++; else fail++; } catch(e){ console.log('✘', name, e.message); fail++; } };

await expectEq('profile created by trigger', () => q(`select full_name from public.profiles order by full_name`).then(r=>r.map(x=>x.full_name)), ['', 'Ana']);

// --- Migración de datos v1 → v2 ---
await expectOk('legacy catalog migrated to Home page', async () => {
  const [page] = await q(`select title, slug, is_home, sections from public.catalog_pages where business_id=$1`, [LEGACY_BIZ]);
  const types = page.sections.map((s) => s.type).join(',');
  if (!page.is_home || types !== 'hero,catalog,contact') throw new Error(JSON.stringify(page));
  const catalogSection = page.sections[1].content;
  if (catalogSection.layout !== 'list' || catalogSection.showSearch !== false || catalogSection.columns.desktop !== 2) throw new Error('v1 options lost: ' + JSON.stringify(catalogSection));
  if (page.sections[0].style.background.image.path !== `${LEGACY_BIZ}/cover/x.jpg`) throw new Error('cover lost');
  return types;
});
await expectOk('legacy navigation points to Home', async () => {
  const [c] = await q(`select c.navigation, p.id as page from public.catalogs c join public.catalog_pages p on p.catalog_id = c.id where c.business_id=$1`, [LEGACY_BIZ]);
  if (c.navigation.items[0].pageId !== c.page) throw new Error(JSON.stringify(c.navigation));
});
await expectOk('legacy public site includes pages', async () => {
  await as(null);
  const [{ c }] = await q(`select public.get_public_catalog('legado') as c`);
  await db.exec('reset role');
  if (c.pages.length !== 1 || c.catalog.navigation.items.length !== 1 || 'pdf' in c.catalog) throw new Error(JSON.stringify(Object.keys(c.catalog)));
});

await as(A);
let bizA, bizB, catA, catB, catgA, itemA;
await expectOk('A creates business', async () => { bizA = (await q(`select public.create_business('Tienda A','tienda-a','{"phone":"1"}','{"version":1}','{}') as id`))[0].id; return bizA; });
await expectErr('reserved slug rejected', () => q(`select public.create_business('X','dashboard')`), 'slug_unavailable');
await expectErr('duplicate slug rejected', () => q(`select public.create_business('X','tienda-a')`), 'slug_unavailable');
await expectErr('A cannot insert business directly', () => q(`insert into public.businesses(name, slug) values ('Hack','hack-biz')`), 'row-level security');
catA = (await q(`select id, status, slug from public.catalogs where business_id=$1`, [bizA]))[0];
await expectOk('default catalog exists', async () => catA);
await expectOk('A creates category', async () => { catgA = (await q(`insert into public.categories(business_id, catalog_id, name) values ($1,$2,'Bebidas') returning id`, [bizA, catA.id]))[0].id; });
await expectOk('A creates item', async () => { itemA = (await q(`insert into public.catalog_items(business_id, catalog_id, category_id, name, slug, price) values ($1,$2,$3,'Café','cafe', 2.5) returning id`, [bizA, catA.id, catgA]))[0].id; });
await expectOk('A creates 2nd item (no category)', () => q(`insert into public.catalog_items(business_id, catalog_id, name, slug, type) values ($1,$2,'Asesoría','asesoria','service')`, [bizA, catA.id]));
await expectOk('A adds image', () => q(`insert into public.catalog_item_images(business_id, item_id, storage_path) values ($1,$2,$3)`, [bizA, itemA, `${bizA}/items/x.jpg`]));
await expectErr('image path outside business rejected', () => q(`insert into public.catalog_item_images(business_id, item_id, storage_path) values ($1,$2,$3)`, [bizA, itemA, `${B}/items/x.jpg`]), 'check constraint');
await expectOk('A storage upload in own folder', () => q(`insert into storage.objects(bucket_id, name) values ('catalog-media', $1)`, [`${bizA}/items/x.jpg`]));
await expectOk('A reorders', () => q(`select public.reorder_rows('catalog_items', array[(select id from public.catalog_items where slug='asesoria'), $1::uuid])`, [itemA]));
await expectEq('positions updated', () => q(`select slug, position from public.catalog_items order by position`).then(r=>r.map(x=>`${x.slug}:${x.position}`)), ['asesoria:0','cafe:1']);
await expectErr('reorder bad table', () => q(`select public.reorder_rows('businesses', array[]::uuid[])`), 'invalid_table');

await as(B);
await expectOk('B creates business', async () => { bizB = (await q(`select public.create_business('Tienda B','tienda-b') as id`))[0].id; });
catB = (await q(`select id from public.catalogs where business_id=$1`, [bizB]))[0];
await expectEq('B sees only own businesses', () => q(`select slug from public.businesses`).then(r=>r.map(x=>x.slug)), ['tienda-b']);
await expectEq('B sees none of A items', () => q(`select count(*)::int as n from public.catalog_items`).then(r=>r[0].n), 0);
await expectEq('B update A item affects 0 rows', () => db.query(`update public.catalog_items set name='pwn' where id=$1`, [itemA]).then(r=>r.affectedRows), 0);
await expectEq('B delete A item affects 0 rows', () => db.query(`delete from public.catalog_items where id=$1`, [itemA]).then(r=>r.affectedRows), 0);
await expectErr('B insert item into A business', () => q(`insert into public.catalog_items(business_id, catalog_id, name, slug) values ($1,$2,'x','x')`, [bizA, catA.id]), 'row-level security');
await expectErr('B insert item in own biz pointing to A catalog (FK)', () => q(`insert into public.catalog_items(business_id, catalog_id, name, slug) values ($1,$2,'x','x')`, [bizB, catA.id]), 'foreign key');
await expectErr('B insert item in own biz pointing to A category (FK)', () => q(`insert into public.catalog_items(business_id, catalog_id, category_id, name, slug) values ($1,$2,$3,'x','x')`, [bizB, catB.id, catgA]), 'foreign key');
await expectErr('B storage upload into A folder', () => q(`insert into storage.objects(bucket_id, name) values ('catalog-media', $1)`, [`${bizA}/items/evil.jpg`]), 'row-level security');
await expectEq('B cannot see A storage objects', () => q(`select count(*)::int n from storage.objects`).then(r=>r[0].n), 0);
await expectEq('B reorder of A rows is no-op', async () => { await q(`select public.reorder_rows('catalog_items', array[$1::uuid])`, [itemA]); await as(A); const r = await q(`select position from public.catalog_items where id=$1`, [itemA]); await as(B); return r[0].position; }, 1);
await expectErr('B cannot add self to A', () => q(`insert into public.business_members(business_id, user_id, role) values ($1,$2,'owner')`, [bizA, B]), 'row-level security');
await expectErr('owner cannot self-upgrade plan', () => q(`update public.businesses set plan_id='pro' where id=$1`, [bizB]), 'permission denied');
await expectOk('owner can edit business profile', () => q(`update public.businesses set name='Tienda B2', contact='{"email":"b@b.co"}' where id=$1 returning name`, [bizB]));
await expectErr('owner cannot set reserved slug', () => q(`update public.businesses set slug='dashboard' where id=$1`, [bizB]), 'check constraint');

await as(null);
await expectEq('anon: no direct table access', () => q(`select count(*)::int n from public.catalog_items`).then(r=>r[0].n), 0);
await expectEq('anon: draft catalog not public', () => q(`select public.get_public_catalog('tienda-a') as c`).then(r=>r[0].c), null);
await as(A);
await q(`update public.catalogs set status='published', published_at=now() where id=$1`, [catA.id]);
await q(`update public.catalog_items set is_visible=false where slug='asesoria'`);
await as(null);
await expectOk('anon: published catalog visible', async () => { const c = (await q(`select public.get_public_catalog('tienda-a') as c`))[0].c; if (c.items.length!==1 || c.items[0].images.length!==1 || c.categories.length!==1) throw new Error(JSON.stringify(c)); if ('plan_id' in c.business) throw new Error('leaks plan'); return {items: c.items.map(i=>i.slug), business: c.business}; });
await expectErr('anon cannot create business', () => q(`select public.create_business('x','anon-biz')`), 'permission denied');
await as(A);
await q(`update public.categories set is_active=false`);
await as(null);
await expectEq('inactive category hides its items', () => q(`select jsonb_array_length(public.get_public_catalog('tienda-a')->'items') n`).then(r=>r[0].n), 0);

// plan limit
await db.exec(`reset role; update public.plans set limits = jsonb_set(limits, '{max_items}', '2') where id='free';`);
await as(A);
await expectErr('plan item limit enforced', () => q(`insert into public.catalog_items(business_id, catalog_id, name, slug) values ($1,$2,'z','z')`, [bizA, catA.id]), 'plan_limit_reached');
await expectEq('updated_at trigger', () => q(`update public.catalog_items set name='Café 2' where id=$1 returning updated_at > created_at as ok`, [itemA]).then(r=>r[0].ok), true);
// --- Páginas / save_site (v2) ---
await db.exec(`reset role; update public.plans set limits = jsonb_set(limits, '{max_items}', '50') where id='free';`);
const P1 = '11111111-0000-4000-8000-000000000001', P2 = '22222222-0000-4000-8000-000000000002', P3 = '33333333-0000-4000-8000-000000000003';
const page = (id, title, slug, is_home, extra = {}) => ({ id, title, slug, is_home, is_published: true, sections: [{ id: 's1', type: 'text', visible: true, content: {}, style: {} }], style: {}, seo: {}, ...extra });
const saveSite = (catalogId, pages, nav = null, deleted = []) =>
  q(`select public.save_site($1, null, $2::jsonb, $3::jsonb, $4::uuid[])`, [catalogId, nav && JSON.stringify(nav), JSON.stringify(pages), deleted]);
await as(A);
await expectOk('A saves site with 2 pages', () => saveSite(catA.id, [page(P1, 'Inicio', 'inicio', true), page(P2, 'Productos', 'productos', false)], { items: [{ id: 'n1', kind: 'page', pageId: P1 }] }));
await expectEq('pages ordered by payload', () => q(`select slug, position, is_home from public.catalog_pages where catalog_id=$1 and deleted_at is null order by position`, [catA.id]).then(r => r.map(x => `${x.slug}:${x.position}:${x.is_home}`)), ['inicio:0:true', 'productos:1:false']);
await expectOk('A swaps slugs and home atomically', () => saveSite(catA.id, [page(P2, 'Productos', 'inicio', true), page(P1, 'Inicio', 'productos', false)]));
await expectEq('swap applied', () => q(`select id, slug, is_home from public.catalog_pages where catalog_id=$1 and deleted_at is null order by position`, [catA.id]).then(r => r.map(x => `${x.id === P2 ? 'P2' : 'P1'}:${x.slug}:${x.is_home}`)), ['P2:inicio:true', 'P1:productos:false']);
await expectErr('duplicate slugs rejected', () => saveSite(catA.id, [page(P1, 'A', 'x', true), page(P3, 'B', 'x', false)]), 'catalog_pages_slug_key');
await expectErr('exactly one home required', () => saveSite(catA.id, [page(P1, 'A', 'a', false)]), 'home_required');
await expectErr('reserved slug "p" rejected', () => saveSite(catA.id, [page(P1, 'A', 'p', true)]), 'check constraint');
await expectOk('A deletes a page (soft)', () => saveSite(catA.id, [page(P2, 'Productos', 'inicio', true)], null, [P1]));
await expectEq('deleted page hidden, slug freed', () => q(`select count(*)::int n from public.catalog_pages where catalog_id=$1 and deleted_at is null`, [catA.id]).then(r => r[0].n), 1);
await expectOk('A adds unpublished page', () => saveSite(catA.id, [page(P2, 'Productos', 'inicio', true), page(P3, 'Borrador', 'borrador', false, { is_published: false })]));
await as(B);
await expectErr('B cannot save_site on A catalog', () => saveSite(catA.id, [page(P3, 'Hack', 'hack', true)]), 'catalog_not_found');
await expectErr('B cannot hijack A page id from own catalog', () => saveSite(catB.id, [page(P2, 'Hack', 'hack', true)]), 'page_conflict');
await expectEq('B cannot read A pages', () => q(`select count(*)::int n from public.catalog_pages where catalog_id=$1`, [catA.id]).then(r => r[0].n), 0);
await expectErr('B cannot insert page into A', () => q(`insert into public.catalog_pages(business_id, catalog_id, title, slug) values ($1,$2,'x','x')`, [bizA, catA.id]), 'row-level security');
await expectErr('B cannot update A slogan', async () => { const r = await db.query(`update public.businesses set slogan='pwn' where id=$1`, [bizA]); if (r.affectedRows === 0) throw new Error('row-level security: 0 rows'); }, 'row-level security');
await as(A);
await expectEq('A page untouched by B', () => q(`select title from public.catalog_pages where id=$1`, [P2]).then(r => r[0].title), 'Productos');
await expectOk('A can set slogan', () => q(`update public.businesses set slogan='Lo mejor' where id=$1 returning slogan`, [bizA]));
await as(null);
await expectEq('anon sees only published pages', () => q(`select jsonb_array_length(public.get_public_catalog('tienda-a')->'pages') n`).then(r => r[0].n), 1);
await expectErr('anon cannot call save_site', () => saveSite(catA.id, [page(P1, 'x', 'x', true)]), 'permission denied');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
