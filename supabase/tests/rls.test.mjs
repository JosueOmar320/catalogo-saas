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
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
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
insert into auth.users(id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-4000-8000-000000000001','ana@example.com','{"full_name":"Ana"}'),
 ('bbbbbbbb-0000-4000-8000-000000000002','ana@otro.com','{}');
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

// --- v4: el administrador aprovisiona cuentas y negocios ---
const ADM = 'dddddddd-0000-4000-8000-000000000004', JUAN = 'eeeeeeee-0000-4000-8000-000000000005', SELF = 'ffffffff-0000-4000-8000-000000000006';
await db.exec(`reset role;
insert into auth.users(id, email, raw_app_meta_data) values
 ('${ADM}', 'admin@usuarios.invalid', '{"provisioned":true,"username":"jefa"}'),
 ('${JUAN}', 'juan@usuarios.invalid', '{"provisioned":true,"username":"Juan","contact_email":"juan@correo.com"}'),
 ('${SELF}', 'intruso@example.com', '{}');
select public.bootstrap_platform_admin('jefa');`);
await expectEq('existing users get usernames from their email', () => q(`select username from public.profiles where id in ($1,$2) order by username`, [A, B]).then((r) => r.map((x) => x.username)), ['ana', 'ana-bbbb']);
await expectEq('provisioned user: username, contact email, active', () => q(`select username, email, status, platform_role from public.profiles where id=$1`, [JUAN]).then((r) => r[0]), { username: 'juan', email: 'juan@correo.com', status: 'active', platform_role: 'user' });
await expectEq('self-registered account is born disabled', () => q(`select status from public.profiles where id=$1`, [SELF]).then((r) => r[0].status), 'disabled');

await as(A);
let bizA, bizB, catA, catB, catgA, itemA;
await expectErr('user cannot create businesses (old RPC)', () => q(`select public.create_business('X','x-biz')`), 'permission denied');
await expectErr('user cannot use admin RPC', () => q(`select public.admin_create_business('X','x-biz')`), 'forbidden');
await as(ADM);
await expectOk('admin creates business for A', async () => { bizA = (await q(`select public.admin_create_business('Tienda A','tienda-a',$1,'free','{"phone":"1"}','{"version":1}','{}') as id`, [A]))[0].id; return bizA; });
await expectErr('reserved slug rejected', () => q(`select public.admin_create_business('X','dashboard')`), 'slug_unavailable');
await expectErr('duplicate slug rejected', () => q(`select public.admin_create_business('X','tienda-a')`), 'slug_unavailable');
await as(A);
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

await as(ADM);
await expectOk('admin creates business for B', async () => { bizB = (await q(`select public.admin_create_business('Tienda B','tienda-b',$1) as id`, [B]))[0].id; });
await as(B);
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

// --- v3: atributos personalizados ---
await as(A);
await expectOk('A defines custom attributes', () => q(`update public.catalogs set attribute_defs = $2::jsonb where id = $1 returning id`, [catA.id, JSON.stringify([{ id: 'marca', name: 'Marca', type: 'select', options: ['X'] }])]));
await expectErr('attribute_defs must be an array', () => q(`update public.catalogs set attribute_defs = '{}'::jsonb where id = $1`, [catA.id]), 'check constraint');
await as(B);
await expectEq('B cannot change A attribute defs', () => db.query(`update public.catalogs set attribute_defs = '[]'::jsonb where id = $1`, [catA.id]).then((r) => r.affectedRows), 0);
await as(null);
await expectEq('public catalog exposes attribute defs', () => q(`select public.get_public_catalog('tienda-a')->'catalog'->'attribute_defs'->0->>'name' as n`).then((r) => r[0].n), 'Marca');

// --- v4: roles, estados, suspensión, auditoría y medios ---
await as(A);
await expectErr('user cannot make himself admin', () => q(`update public.profiles set platform_role='admin' where id=$1`, [A]), 'permission denied');
await expectErr('user cannot change own status', () => q(`update public.profiles set status='active' where id=$1`, [A]), 'permission denied');
await expectErr('user cannot rename own username', () => q(`update public.profiles set username='jefe' where id=$1`, [A]), 'permission denied');
await expectOk('user can edit own name', () => q(`update public.profiles set full_name='Ana María' where id=$1 returning full_name`, [A]));
await expectErr('user cannot bootstrap admin', () => q(`select public.bootstrap_platform_admin('ana')`), 'permission denied');
await expectErr('user cannot write audit entries', () => q(`select public.log_audit('x','y','z')`), 'forbidden');
await expectErr('user cannot update other profiles via admin RPC', () => q(`select public.admin_update_profile($1,'x',null,'admin','active',null)`, [A]), 'forbidden');
await expectEq('user sees only own and team profiles', () => q(`select username from public.profiles order by username`).then((r) => r.map((x) => x.username)), ['ana']);
await expectEq('user cannot read audit log', () => q(`select count(*)::int n from public.audit_log`).then((r) => r[0].n), 0);
await expectErr('owner cannot activate/deactivate catalog', () => q(`update public.catalogs set is_active=false where id=$1`, [catA.id]), 'permission denied');
await expectErr('owner cannot suspend/reactivate business', () => q(`update public.businesses set status='active' where id=$1`, [bizA]), 'permission denied');
await expectOk('member registers media in own business', () => q(`insert into public.media_assets(business_id, path, kind, alt) values ($1,$2,'site','Fachada') returning id`, [bizA, `${bizA}/site/fachada.jpg`]));
await expectErr('media path must belong to the business', () => q(`insert into public.media_assets(business_id, path) values ($1,$2)`, [bizA, `${bizB}/site/x.jpg`]), 'check constraint');
await as(B);
await expectEq('B cannot see A media', () => q(`select count(*)::int n from public.media_assets`).then((r) => r[0].n), 0);
await expectErr('B cannot register media in A', () => q(`insert into public.media_assets(business_id, path) values ($1,$2)`, [bizA, `${bizA}/site/evil.jpg`]), 'row-level security');

await as(ADM);
await expectEq('admin reads every business', () => q(`select slug from public.businesses where slug in ('tienda-a','tienda-b') order by slug`).then((r) => r.map((x) => x.slug)), ['tienda-a', 'tienda-b']);
await expectOk('admin can edit content of any business', () => q(`update public.catalog_items set name='Café admin' where id=$1 returning name`, [itemA]));
await expectEq('admin reads all profiles', () => q(`select count(*)::int n from public.profiles`).then((r) => r[0].n), 5);
await expectErr('admin cannot demote himself', () => q(`select public.admin_update_profile($1,'Jefa',null,'user','active',null)`, [ADM]), 'cannot_demote_self');
await expectOk('admin assigns A business to Juan as editor', () => q(`select public.admin_set_business_member($1,$2,'editor')`, [bizA, JUAN]));
await expectOk('admin limits Juan to 1 business', () => q(`select public.admin_update_profile($1,'Juan Pérez','juan@correo.com','user','active',1)`, [JUAN]));
await expectErr('business quota enforced', () => q(`select public.admin_set_business_member($1,$2,'editor')`, [bizB, JUAN]), 'business_limit_reached');
await as(JUAN);
await expectEq('Juan only sees assigned business', () => q(`select slug from public.businesses`).then((r) => r.map((x) => x.slug)), ['tienda-a']);
await expectEq('Juan sees his teammates', () => q(`select username from public.profiles order by username`).then((r) => r.map((x) => x.username)), ['ana', 'juan']);
await as(ADM);
await expectOk('admin disables Juan', () => q(`select public.admin_update_profile($1,'Juan Pérez','juan@correo.com','user','disabled',1)`, [JUAN]));
await as(JUAN);
await expectEq('disabled user sees no business', () => q(`select count(*)::int n from public.businesses`).then((r) => r[0].n), 0);
await expectErr('disabled user cannot write content', () => q(`insert into public.categories(business_id, catalog_id, name) values ($1,$2,'x')`, [bizA, catA.id]), 'row-level security');
await as(ADM);
await expectOk('admin suspends business B', () => q(`select public.admin_update_business($1,'Tienda B2','tienda-b','free','suspended')`, [bizB]));
await as(B);
await expectEq('owner of suspended business loses access', () => q(`select count(*)::int n from public.businesses`).then((r) => r[0].n), 0);
await as(A);
await q(`update public.catalogs set status='published' where business_id=$1`, [bizA]);
await as(ADM);
await expectOk('admin deactivates catalog A', () => q(`select public.admin_update_catalog($1,'Tienda A',false,false)`, [catA.id]));
await as(null);
await expectEq('inactive catalog is not public', () => q(`select public.get_public_catalog('tienda-a') as c`).then((r) => r[0].c), null);
await expectErr('anon cannot use admin RPCs', () => q(`select public.admin_create_business('x','anon-x')`), 'permission denied');
await as(ADM);
await expectOk('admin reactivates catalog', () => q(`select public.admin_update_catalog($1,'Tienda A',true,false)`, [catA.id]));
await expectEq('audit: who created business A', () => q(`select actor_id, action from public.audit_log where entity_id=$1 and action='businesses.insert'`, [bizA]).then((r) => r[0]), { actor_id: ADM, action: 'businesses.insert' });
await expectEq('audit: who disabled Juan (changed columns)', () => q(`select actor_id, metadata->'changed' as changed from public.audit_log where action='profiles.update' and entity_id=$1 order by id desc limit 1`, [JUAN]).then((r) => r[0]), { actor_id: ADM, changed: ['status'] });
await expectOk('audit: content edits are attributed', async () => {
  const r = await q(`select count(*)::int n from public.audit_log where action='catalog_items.update' and actor_id=$1`, [ADM]);
  if (r[0].n < 1) throw new Error('no audit row');
});
await expectOk('admin writes explicit audit event', () => q(`select public.log_audit('user.password_reset','user',$1)`, [JUAN]));
await expectOk('admin promotes A to admin', () => q(`select public.admin_update_profile($1,'Ana María','ana@example.com','admin','active',null)`, [A]));
await as(A);
await expectOk('second admin can demote the first', () => q(`select public.admin_update_profile($1,'Jefa',null,'user','active',null)`, [ADM]));
await as(ADM);
await expectEq('demoted admin loses admin access', () => q(`select count(*)::int n from public.audit_log`).then((r) => r[0].n), 0);


// --- v5: biblioteca de medios (URLs externas, uso y reemplazo) ---
await as(A);
const OLD = `${bizA}/items/x.jpg`, NEW = `${bizA}/media/nueva.jpg`;
await expectOk('external URL registered in library', () => q(`insert into public.media_assets(business_id, path, storage_provider, public_url, folder, name) values ($1,'https://cdn.example.com/a.jpg','external','https://cdn.example.com/a.jpg','backgrounds','Fondo') returning id`, [bizA]));
await expectErr('external media must be https', () => q(`insert into public.media_assets(business_id, path, storage_provider) values ($1,'http://cdn.example.com/a.jpg','external')`, [bizA]), 'check constraint');
await expectErr('storage media cannot point to a URL', () => q(`insert into public.media_assets(business_id, path) values ($1,'https://cdn.example.com/b.jpg')`, [bizA]), 'check constraint');
await expectErr('unknown folder rejected', () => q(`insert into public.media_assets(business_id, path, folder) values ($1,$2,'secret')`, [bizA, `${bizA}/media/f.jpg`]), 'check constraint');
const homeA = (await q(`select id from public.catalog_pages where business_id=$1 and deleted_at is null order by position limit 1`, [bizA]))[0].id;
await q(`update public.catalog_pages set sections = sections || jsonb_build_array(jsonb_build_object('id','img1','type','image','content', jsonb_build_object('image', jsonb_build_object('path', $1::text)))) where id=$2`, [OLD, homeA]);
await q(`update public.businesses set logo_path=$1 where id=$2`, [OLD, bizA]);
await expectEq('media_references finds every use', () => q(`select place from public.media_references($1,$2) order by place`, [bizA, OLD]).then((r) => r.map((x) => x.place)), ['logo', 'page', 'product']);
await expectErr('replace into another business path rejected', () => q(`select public.replace_media_references($1,$2,$3)`, [bizA, OLD, `${bizB}/media/x.jpg`]), 'invalid_path');
await as(B);
await expectEq('B cannot see where A media is used', () => q(`select count(*)::int n from public.media_references($1,$2)`, [bizA, OLD]).then((r) => r[0].n), 0);
await expectEq('B cannot replace A media', () => q(`select public.replace_media_references($1,$2,$3) n`, [bizA, OLD, NEW]).then((r) => r[0].n), 0);
await as(A);
await expectEq('external URL can be reused by another business', () => q(`insert into public.media_assets(business_id, path, storage_provider) values ($1,'https://cdn.example.com/a.jpg','external') returning storage_provider`, [bizB]).then((r) => r[0].storage_provider), 'external');
await expectOk('replace rewrites logo, page and product', async () => {
  const [{ n }] = await q(`select public.replace_media_references($1,$2,$3,null) n`, [bizA, OLD, NEW]);
  if (n < 3) throw new Error(`only ${n}`);
  return n;
});
await expectEq('old path no longer referenced', () => q(`select count(*)::int n from public.media_references($1,$2)`, [bizA, OLD]).then((r) => r[0].n), 0);
await expectEq('new path referenced everywhere', () => q(`select place from public.media_references($1,$2) order by place`, [bizA, NEW]).then((r) => r.map((x) => x.place)), ['logo', 'page', 'product']);
await as(null);
await expectErr('anon cannot inspect media usage', () => q(`select * from public.media_references($1,$2)`, [bizA, NEW]), 'permission denied');


// --- Rendimiento: conteos del admin en SQL ---
await as(A); // A es administrador en este punto de las pruebas
await expectOk('admin_stats: totales para el admin', async () => {
  const [{ s }] = await q(`select public.admin_stats() s`);
  if (!s || s.users.total < 3 || s.businesses.total < 2 || typeof s.catalogs.published !== 'number') throw new Error(JSON.stringify(s));
  return s.users;
});
await expectOk('admin_catalog_counts: páginas e ítems por catálogo', async () => {
  const rows = await q(`select catalog_id, pages, items from public.admin_catalog_counts() where catalog_id=$1`, [catA.id]);
  const direct = await q(`select (select count(*) from public.catalog_pages where catalog_id=$1 and deleted_at is null)::int p, (select count(*) from public.catalog_items where catalog_id=$1 and deleted_at is null)::int i`, [catA.id]);
  if (Number(rows[0].pages) !== direct[0].p || Number(rows[0].items) !== direct[0].i) throw new Error(JSON.stringify({ rows, direct }));
  return rows[0];
});
await as(JUAN);
await expectEq('admin_stats: un usuario normal no ve nada', () => q(`select public.admin_stats() s`).then((r) => r[0].s), null);
await expectEq('admin_catalog_counts: un usuario normal no ve nada', () => q(`select count(*)::int n from public.admin_catalog_counts()`).then((r) => r[0].n), 0);
await as(null);
await expectErr('anon no puede llamar admin_stats', () => q(`select public.admin_stats()`), 'permission denied');

// --- Endurecimiento de seguridad (20261020) ---
await as(A); // dueño de Tienda A
await expectErr('owner cannot add members directly (only admin RPCs)', () => q(`insert into public.business_members(business_id, user_id, role) values ($1,$2,'admin')`, [bizA, ADM]), 'row-level security');
await expectEq('owner cannot change roles directly', async () => (await db.query(`update public.business_members set role='owner' where business_id=$1`, [bizA])).affectedRows, 0);
await expectEq('owner cannot remove members directly', async () => (await db.query(`delete from public.business_members where business_id=$1`, [bizA])).affectedRows, 0);
await expectErr('owner cannot create catalogs directly (only admin_create_catalog)', () => q(`insert into public.catalogs(business_id, name, slug) values ($1,'Extra','extra')`, [bizA]), 'row-level security');
const mediaToDelete = (await q(`insert into public.media_assets(business_id, path, kind, alt) values ($1,$2,'site','Borrable') returning id`, [bizA, `${bizA}/site/borrable.jpg`]))[0].id;
await q(`select public.admin_update_profile($1,'Juan Pérez','juan@correo.com','user','active',1)`, [JUAN]); // A es administrador aquí
await as(JUAN); // editor activo de Tienda A
await expectEq('editor can read the library', () => q(`select count(*)::int n from public.media_assets where id=$1`, [mediaToDelete]).then((r) => r[0].n), 1);
await expectEq('editor cannot hard-delete library rows', async () => (await db.query(`delete from public.media_assets where id=$1`, [mediaToDelete])).affectedRows, 0);
await as(A);
await expectEq('owner can hard-delete library rows', async () => (await db.query(`delete from public.media_assets where id=$1`, [mediaToDelete])).affectedRows, 1);

// --- Límite de intentos compartido ---
await db.exec('reset role; set role service_role;');
await expectEq('rate limit: allows up to the limit, then blocks', async () => {
  const r = [];
  for (let i = 0; i < 3; i++) r.push((await q(`select public.rate_limit_consume('login:u:ana', 2, 900) ok`))[0].ok);
  return r;
}, [true, true, false]);
await expectEq('rate limit: keys are independent', () => q(`select public.rate_limit_consume('login:u:otra', 2, 900) ok`).then((r) => r[0].ok), true);
await expectEq('rate limit: old attempts leave the window', async () => {
  await db.exec(`reset role; update public.rate_limit_events set created_at = now() - interval '1 hour' where key = 'login:u:ana'; set role service_role;`);
  return (await q(`select public.rate_limit_consume('login:u:ana', 2, 900) ok`))[0].ok;
}, true);
await expectErr('rate limit: rejects invalid arguments', () => q(`select public.rate_limit_consume('', 2, 900)`), 'invalid_rate_limit');
await as(A);
await expectErr('authenticated cannot call rate_limit_consume', () => q(`select public.rate_limit_consume('login:u:ana', 1000, 1)`), 'permission denied');
await expectErr('authenticated cannot read rate_limit_events', () => q(`select * from public.rate_limit_events`), 'permission denied');
await as(null);
await expectErr('anon cannot call rate_limit_consume', () => q(`select public.rate_limit_consume('x', 1000, 1)`), 'permission denied');

// --- Privilegios de funciones (20261021) ---
await as(A);
await expectErr('authenticated cannot call trigger functions directly', () => q(`select public.enforce_item_limit()`), 'permission denied');
await expectErr('authenticated cannot call plan_limit', () => q(`select public.plan_limit($1,'max_items')`, [bizA]), 'permission denied');
await expectErr('authenticated cannot call require_platform_admin directly', () => q(`select public.require_platform_admin()`), 'permission denied');
await expectEq('RLS helpers still work for authenticated', () => q(`select public.is_business_member($1) m`, [bizA]).then((r) => r[0].m), true);
await expectOk('triggers still fire after revoke (item limit + audit)', () => q(`insert into public.categories(business_id, catalog_id, name) values ($1,$2,'Tras revoke') returning id`, [bizA, catA.id]));
await expectOk('admin RPCs still work (SECURITY DEFINER keeps access)', () => q(`select public.admin_update_catalog($1,'Tienda A',true,false)`, [catA.id]));
await as(null);
await expectErr('anon cannot call is_platform_admin', () => q(`select public.is_platform_admin()`), 'permission denied');
await expectErr('anon cannot call has_business_role', () => q(`select public.has_business_role($1, array['owner'])`, [bizA]), 'permission denied');
await expectEq('anon still reads the public catalog', () => q(`select public.get_public_catalog('no-existe') c`).then((r) => r[0].c), null);

// --- Idioma del perfil (20261022) ---
await as(A);
await expectEq('user can set own language', () => q(`update public.profiles set locale='en' where id=$1 returning locale`, [A]).then((r) => r[0].locale), 'en');
await expectErr('only es/en are valid languages', () => q(`update public.profiles set locale='fr' where id=$1`, [A]), 'check constraint');
await expectEq('user cannot change another profile language', async () => (await db.query(`update public.profiles set locale='en' where id=$1`, [B])).affectedRows, 0);
await expectErr('locale grant does not open other columns', () => q(`update public.profiles set platform_role='admin' where id=$1`, [B]), 'permission denied');

// --- Uso del pedido por WhatsApp (20261023) ---
await db.exec('reset role');
const svcA = (await q(`select id from public.catalog_items where business_id=$1 and slug='asesoria'`, [bizA]))[0].id;
const itemB = (await q(`insert into public.catalog_items(business_id, catalog_id, name, slug, price) values ($1,$2,'Ajeno','ajeno', 9) returning id`, [bizB, catB.id]))[0].id;
await q(`update public.catalogs set status='published', is_active=true, settings = coalesce(settings,'{}') || '{"order":{"enabled":true}}' where id=$1`, [catA.id]);
await q(`update public.catalog_items set is_visible=true, is_available=true, deleted_at=null, price=2.5 where id=$1`, [itemA]);
const order = (items, slug = 'tienda-a') => q(`select public.record_order($1, $2::jsonb) ok`, [slug, JSON.stringify(items)]).then((r) => r[0].ok);
// Lee los contadores como superusuario y vuelve al rol en el que estaba la prueba.
const asSuper = async (fn, role) => { await db.exec('reset role'); try { return await fn(); } finally { if (role) await db.exec(`set role ${role}`); } };
const stats = (role = 'service_role') => asSuper(() => q(`select orders, units, value::text from public.order_stats_daily where business_id=$1`, [bizA]).then((r) => r[0] ?? null), role);

await as(null);
await expectErr('anon cannot call record_order', () => order([{ id: itemA, qty: 1 }]), 'permission denied');
await expectErr('anon cannot read order stats', () => q(`select * from public.order_stats_daily`), 'permission denied');
await as(A);
await expectErr('authenticated cannot call record_order', () => order([{ id: itemA, qty: 1 }]), 'permission denied');
await expectErr('authenticated cannot write order stats', () => q(`insert into public.order_stats_daily(business_id, day, orders) values ($1, current_date, 99)`, [bizA]), 'permission denied');

await db.exec('reset role; set role service_role;');
await expectEq('order: counts only available products of that catalog (dupes summed, service and foreign item ignored)', async () => {
  const ok = await order([{ id: itemA, qty: 2 }, { id: itemA, qty: 1 }, { id: svcA, qty: 1 }, { id: itemB, qty: 5 }, { id: 'no-es-uuid', qty: 1 }, 'basura']);
  return { ok, ...(await stats()) };
}, { ok: true, orders: 1, units: 3, value: '7.50' });
await expectEq('order: per-product counters', () => asSuper(() => q(`select item_id, orders, units from public.order_item_stats_daily where business_id=$1`, [bizA]), 'service_role').then((r) => r.map((x) => [x.item_id === itemA, x.orders, x.units])), [[true, 1, 3]]);
await expectEq('order: same day accumulates; quantity capped at 99', async () => { await order([{ id: itemA, qty: 500 }]); return stats(); }, { orders: 2, units: 102, value: '255.00' });
await expectEq('order: nothing valid → false, nothing recorded', async () => [await order([{ id: svcA, qty: 1 }]), await order([]), await order({ id: itemA }), (await stats()).orders], [false, false, false, 2]);
await expectEq('order: unknown business → false', () => order([{ id: itemA, qty: 1 }], 'no-existe'), false);
await expectEq('order: other business slug cannot count A items', () => order([{ id: itemA, qty: 1 }], 'tienda-b'), false);
await db.exec('reset role');
await q(`update public.catalogs set settings = settings || '{"order":{"enabled":false}}' where id=$1`, [catA.id]);
await db.exec('set role service_role');
await expectEq('order: disabled orders → false', () => order([{ id: itemA, qty: 1 }]), false);
await db.exec('reset role');
await q(`update public.catalogs set status='draft', settings = settings || '{"order":{"enabled":true}}' where id=$1`, [catA.id]);
await db.exec('set role service_role');
await expectEq('order: unpublished catalog → false', () => order([{ id: itemA, qty: 1 }]), false);
await db.exec('reset role');
await q(`update public.catalogs set status='published' where id=$1`, [catA.id]);

await as(A);
await expectEq('owner reads own order stats', () => q(`select orders from public.order_stats_daily where business_id=$1`, [bizA]).then((r) => r[0].orders), 2);
await as(B);
await expectEq('other business cannot read A order stats', () => q(`select count(*)::int n from public.order_stats_daily where business_id=$1`, [bizA]).then((r) => r[0].n), 0);
await expectEq('other business cannot read A product stats', () => q(`select count(*)::int n from public.order_item_stats_daily where business_id=$1`, [bizA]).then((r) => r[0].n), 0);

// --- Aviso semanal por correo (20261024) ---
await as(A);
await expectEq('weekly notice is on by default', () => q(`select notify_catalog_review n from public.profiles where id=$1`, [A]).then((r) => r[0].n), true);
await expectEq('user can turn off own weekly notice', () => q(`update public.profiles set notify_catalog_review=false where id=$1 returning notify_catalog_review n`, [A]).then((r) => r[0].n), false);
await expectEq('user cannot change another user notice', async () => (await db.query(`update public.profiles set notify_catalog_review=false where id=$1`, [B])).affectedRows, 0);
await expectErr('authenticated cannot read notification_log', () => q(`select * from public.notification_log`), 'permission denied');
await expectErr('authenticated cannot write notification_log', () => q(`insert into public.notification_log(user_id, business_id, kind) values ($1,$2,'catalog_review')`, [A, bizA]), 'permission denied');
await as(null);
await expectErr('anon cannot read notification_log', () => q(`select * from public.notification_log`), 'permission denied');
await db.exec('reset role');
await expectErr('notification kind is restricted', () => q(`insert into public.notification_log(user_id, business_id, kind) values ($1,$2,'spam')`, [A, bizA]), 'check constraint');

// --- Visitas del sitio publicado (20261025) ---
await db.exec('reset role');
const itemASlug = (await q(`select slug from public.catalog_items where id=$1`, [itemA]))[0].slug;
const view = (slug = 'tienda-a', item = null) => q(`select public.record_view($1, $2) ok`, [slug, item]).then((r) => r[0].ok);
const views = () => asSuper(() => q(`select views from public.site_view_stats_daily where business_id=$1`, [bizA]).then((r) => r[0]?.views ?? 0), 'service_role');
const itemViews = () => asSuper(() => q(`select item_id, views from public.item_view_stats_daily where business_id=$1`, [bizA]).then((r) => r.map((x) => [x.item_id === itemA, x.views])), 'service_role');

await as(null);
await expectErr('anon cannot call record_view', () => view(), 'permission denied');
await expectErr('anon cannot read view stats', () => q(`select * from public.site_view_stats_daily`), 'permission denied');
await as(A);
await expectErr('authenticated cannot call record_view', () => view(), 'permission denied');
await expectErr('authenticated cannot write view stats', () => q(`insert into public.site_view_stats_daily(business_id, day, views) values ($1, current_date, 99)`, [bizA]), 'permission denied');

await db.exec('reset role; set role service_role;');
await expectEq('view: counts pages and the product page of that catalog', async () => [await view(), await view('tienda-a', itemASlug), await views(), await itemViews()], [true, true, 2, [[true, 1]]]);
await expectEq('view: unknown or foreign item counts the page but not the item', async () => [await view('tienda-a', 'ajeno'), await view('tienda-a', 'no-existe'), await views(), await itemViews()], [true, true, 4, [[true, 1]]]);
await expectEq('view: unknown business → false', () => view('no-existe'), false);
await db.exec('reset role');
await q(`update public.catalog_items set is_visible=false where id=$1`, [itemA]);
await db.exec('set role service_role');
await expectEq('view: hidden item is not counted', async () => [await view('tienda-a', itemASlug), await itemViews()], [true, [[true, 1]]]);
await db.exec('reset role');
await q(`update public.catalog_items set is_visible=true where id=$1`, [itemA]);
await q(`update public.catalogs set status='draft' where id=$1`, [catA.id]);
await db.exec('set role service_role');
await expectEq('view: unpublished catalog → false', async () => [await view(), await views()], [false, 5]);
await db.exec('reset role');
await q(`update public.catalogs set status='published' where id=$1`, [catA.id]);

await as(A);
await expectEq('owner reads own view stats', () => q(`select views from public.site_view_stats_daily where business_id=$1`, [bizA]).then((r) => r[0].views), 5);
await as(B);
await expectEq('other business cannot read A view stats', () => q(`select count(*)::int n from public.site_view_stats_daily where business_id=$1`, [bizA]).then((r) => r[0].n), 0);
await expectEq('other business cannot read A item view stats', () => q(`select count(*)::int n from public.item_view_stats_daily where business_id=$1`, [bizA]).then((r) => r[0].n), 0);

// --- Reseñas (20261026) ---
await db.exec('reset role');
await q(`update public.catalogs set settings = coalesce(settings,'{}') || '{"reviews":{"enabled":true}}' where id=$1`, [catA.id]);
const itemASlugR = (await q(`select slug from public.catalog_items where id=$1`, [itemA]))[0].slug;
const review = (item, name = 'Ana', rating = 5, body = 'Muy rico') => q(`select public.submit_review('tienda-a', $1, $2, $3, $4) ok`, [item, name, rating, body]).then((r) => r[0].ok);
const publicReviews = () => q(`select name, rating from public.get_public_reviews('tienda-a') order by name`);

await as(null);
await expectErr('anon cannot submit reviews directly', () => review(null), 'permission denied');
await expectErr('anon cannot read the reviews table', () => q(`select * from public.reviews`), 'permission denied');
await as(A);
await expectErr('authenticated cannot submit reviews directly', () => review(null), 'permission denied');
await expectErr('authenticated cannot insert reviews', () => q(`insert into public.reviews(business_id, name, rating) values ($1,'Yo',5)`, [bizA]), 'permission denied');

await db.exec('reset role; set role service_role;');
await expectEq('review: business and product reviews enter as pending', async () => [await review(null), await review(itemASlugR, 'Beto', 4, '')], [true, true]);
await expectEq('review: invalid rating, empty name or foreign product → false', async () => [await review(null, 'X', 6), await review(null, '  '), await review('ajeno'), await review(null, 'X', 3, 'x'.repeat(601))], [false, false, false, false]);
await expectEq('review: pending ones are not public', () => publicReviews(), []);

await as(A);
await expectEq('owner sees pending reviews', () => q(`select count(*)::int n from public.reviews where business_id=$1 and status='pending'`, [bizA]).then((r) => r[0].n), 2);
await expectOk('owner approves', () => q(`update public.reviews set status='approved', reviewed_at=now() where business_id=$1`, [bizA]));
await expectErr('owner cannot edit what the customer wrote', () => q(`update public.reviews set body='otra cosa' where business_id=$1`, [bizA]), 'permission denied');
await as(null);
await expectEq('approved reviews are public (anon)', () => publicReviews(), [{ name: 'Ana', rating: 5 }, { name: 'Beto', rating: 4 }]);
await db.exec('reset role');
await q(`update public.catalog_items set is_visible=false where id=$1`, [itemA]);
await as(null);
await expectEq('review of a hidden product is not public', () => publicReviews().then((r) => r.map((x) => x.name)), ['Ana']);
await db.exec('reset role');
await q(`update public.catalog_items set is_visible=true where id=$1`, [itemA]);
await q(`update public.catalogs set settings = settings || '{"reviews":{"enabled":false}}' where id=$1`, [catA.id]);
await as(null);
await expectEq('reviews turned off → none public', () => publicReviews(), []);
await db.exec('reset role; set role service_role;');
await expectEq('reviews turned off → cannot submit', () => review(null), false);
await as(B);
await expectEq('other business cannot read A reviews', () => q(`select count(*)::int n from public.reviews where business_id=$1`, [bizA]).then((r) => r[0].n), 0);
await expectEq('other business cannot moderate A reviews', async () => (await db.query(`update public.reviews set status='rejected' where business_id=$1`, [bizA])).affectedRows, 0);

// --- Búsquedas sin resultados (20261027) ---
await db.exec('reset role');
const miss = (term, slug = 'tienda-a') => q(`select public.record_search_miss($1, $2) ok`, [slug, term]).then((r) => r[0].ok);
const misses = () => asSuper(() => q(`select term, searches from public.search_miss_stats_daily where business_id=$1 order by term`, [bizA]), 'service_role');

await as(null);
await expectErr('anon cannot call record_search_miss', () => miss('pastel'), 'permission denied');
await expectErr('anon cannot read search misses', () => q(`select * from public.search_miss_stats_daily`), 'permission denied');
await as(A);
await expectErr('authenticated cannot call record_search_miss', () => miss('pastel'), 'permission denied');
await expectErr('authenticated cannot write search misses', () => q(`insert into public.search_miss_stats_daily(business_id, day, term, searches) values ($1, current_date, 'x y', 9)`, [bizA]), 'permission denied');

await db.exec('reset role; set role service_role;');
await expectEq('search miss: normalizes and counts per term', async () => [await miss('  Pastel   de  Chocolate '), await miss('pastel de chocolate'), await miss('flan'), await misses()], [
  true,
  true,
  true,
  [
    { term: 'flan', searches: 1 },
    { term: 'pastel de chocolate', searches: 2 },
  ],
]);
await expectEq('search miss: too short, too long or unknown business → false', async () => [await miss('a'), await miss('x'.repeat(61)), await miss('flan', 'no-existe')], [false, false, false]);
await db.exec('reset role');
await q(`insert into public.search_miss_stats_daily(business_id, day, term, searches) select $1, (now() at time zone 'utc')::date, 'relleno ' || g, 1 from generate_series(1, 198) g`, [bizA]);
await db.exec('set role service_role');
await expectEq('search miss: at most 200 distinct terms per day (known terms still count)', async () => [await miss('nuevo'), await miss('flan')], [false, true]);
await db.exec('reset role');
await q(`update public.catalogs set status='draft' where id=$1`, [catA.id]);
await db.exec('set role service_role');
await expectEq('search miss: unpublished catalog → false', () => miss('flan'), false);
await db.exec('reset role');
await q(`update public.catalogs set status='published' where id=$1`, [catA.id]);

await as(A);
await expectEq('owner reads own search misses', () => q(`select searches from public.search_miss_stats_daily where business_id=$1 and term='flan'`, [bizA]).then((r) => r[0].searches), 2);
await as(B);
await expectEq('other business cannot read A search misses', () => q(`select count(*)::int n from public.search_miss_stats_daily where business_id=$1`, [bizA]).then((r) => r[0].n), 0);

// --- Costos de los productos (20261028) ---
await db.exec('reset role');
await q(`update public.catalogs set status='published' where id=$1`, [catA.id]);
await as(null);
await expectErr('anon cannot read item costs', () => q(`select * from public.item_costs`), 'permission denied');
await as(A);
await expectOk('owner saves the cost of own item', () => q(`insert into public.item_costs(item_id, business_id, cost) values ($1,$2,12.5)`, [itemA, bizA]));
await expectEq('owner reads and updates it', async () => {
  await q(`update public.item_costs set cost=13 where item_id=$1`, [itemA]);
  return (await q(`select cost::float c from public.item_costs where item_id=$1`, [itemA]))[0].c;
}, 13);
await expectErr('cost cannot be negative', () => q(`update public.item_costs set cost=-1 where item_id=$1`, [itemA]), 'check constraint');
await as(B);
await expectEq('other business cannot read A costs', () => q(`select count(*)::int n from public.item_costs where business_id=$1`, [bizA]).then((r) => r[0].n), 0);
await expectErr('other business cannot write a cost for A item', () => q(`insert into public.item_costs(item_id, business_id, cost) values ($1,$2,1)`, [itemA, bizA]), 'row-level security');
await expectErr('nor point another business at A item (RLS or FK)', () => q(`insert into public.item_costs(item_id, business_id, cost) values ($1,$2,1)`, [itemA, bizB]), 'violates');
await as(null);
await expectEq('the public catalog does not include costs', () => q(`select public.get_public_catalog('tienda-a')::text t`).then((r) => /"cost"|item_costs/.test(r[0].t)), false);

/* ------------------------------------------------------------ Plantillas de sección */
const tpl = (biz, name = 'Hero de verano') => q(`insert into public.section_templates(business_id, name, section) values ($1,$2,'{"type":"hero"}'::jsonb) returning id`, [biz, name]).then((r) => r[0].id);
await as(null);
await expectErr('anon cannot read section templates', () => q(`select * from public.section_templates`), 'permission denied');
await as(A);
let tplA;
await expectOk('owner saves a section template', async () => { tplA = await tpl(bizA); return tplA; });
await expectEq('owner lists own templates', () => q(`select name from public.section_templates where business_id=$1`, [bizA]).then((r) => r.map((x) => x.name)), ['Hero de verano']);
await expectErr('name cannot be blank', () => tpl(bizA, '   '), 'check constraint');
await expectErr('section must be an object', () => q(`insert into public.section_templates(business_id, name, section) values ($1,'x','[]'::jsonb)`, [bizA]), 'check constraint');
await as(B);
await expectEq('other business cannot read A templates', () => q(`select count(*)::int n from public.section_templates where business_id=$1`, [bizA]).then((r) => r[0].n), 0);
await expectErr('other business cannot save into A', () => tpl(bizA), 'row-level security');
await expectEq('other business cannot delete A templates', () => q(`delete from public.section_templates where id=$1 returning id`, [tplA]).then((r) => r.length), 0);
await as(A);
await expectErr('at most 50 templates per business', async () => { for (let i = 0; i < 50; i++) await tpl(bizA, `Plantilla ${i}`); }, 'section_template_limit_reached');
await expectEq('the limit kept 50', () => q(`select count(*)::int n from public.section_templates where business_id=$1`, [bizA]).then((r) => r[0].n), 50);
await expectOk('owner deletes own templates', () => q(`delete from public.section_templates where business_id=$1`, [bizA]));
/* ------------------------------------------------------------ Código propio (lo habilita el administrador) */
// Aquí A es administrador de la plataforma y B un dueño sin permisos de administración.
const customCode = () => q(`select (public.get_public_catalog('tienda-a') -> 'business' ->> 'custom_code')::boolean v`).then((r) => r[0].v);
await as(null);
await expectEq('custom code is off by default (public catalog)', customCode, false);
await as(B);
await expectErr('owner cannot enable custom code for own business', () => q(`update public.businesses set custom_code=true where id=$1`, [bizB]), 'permission denied');
await expectErr('owner cannot use the admin RPC', () => q(`select public.admin_set_custom_code($1, true)`, [bizB]), 'forbidden');
await expectErr('owner cannot enable it for a plan', () => q(`select public.admin_set_plan_custom_code('free', true)`), 'forbidden');
await as(A);
await expectOk('admin enables custom code for the free plan', () => q(`select public.admin_set_plan_custom_code('free', true)`));
await as(null);
await expectEq('the plan enables it', customCode, true);
await as(A);
await expectOk('admin turns it off for this business', () => q(`select public.admin_set_custom_code($1, false)`, [bizA]));
await as(null);
await expectEq('the business decision wins over the plan', customCode, false);
await as(A);
await expectOk('admin goes back to the plan (null)', () => q(`select public.admin_set_custom_code($1, null)`, [bizA]));
await expectErr('unknown plan', () => q(`select public.admin_set_plan_custom_code('nope', true)`), 'plan_not_found');
await expectOk('admin turns the plan feature off again', () => q(`select public.admin_set_plan_custom_code('free', false)`));
await as(null);
await expectEq('off again', customCode, false);

/* ------------------------------------------------------------ Bandeja de pedidos */
await db.exec('reset role');
await q(`update public.catalogs set status='published', is_active=true, deleted_at=null, settings = coalesce(settings,'{}') || '{"order":{"enabled":true}}' where id=$1`, [catA.id]);
await q(`update public.catalog_items set is_visible=true, is_available=true, deleted_at=null, price=2.5, attributes = coalesce(attributes,'{}') || '{"stock": 5}' where id=$1`, [itemA]);
const setOrderSettings = async (patch) => { await db.exec('reset role'); await q(`update public.catalogs set settings = jsonb_set(settings, '{order}', (settings -> 'order') || $2::jsonb) where id=$1`, [catA.id, JSON.stringify(patch)]); };
const sendOrder = async (order, items = [{ id: itemA, qty: 2 }], slug = 'tienda-a') => { await db.exec('reset role; set role service_role'); return q(`select public.record_order_v2($1, $2::jsonb, $3::jsonb) ok`, [slug, JSON.stringify(items), JSON.stringify(order)]).then((r) => r[0].ok); };
const inbox = () => asSuper(() => q(`select reference, status, customer_name, fulfillment, address, lines, total::text, partial, personal_data_cleared from public.orders where business_id=$1 order by created_at, reference`, [bizA]));
const stockA = () => asSuper(() => q(`select attributes->>'stock' s from public.catalog_items where id=$1`, [itemA]).then((r) => r[0].s));
const baseOrder = { reference: 'K7Q2', customerName: '  Ana  ', fulfillment: 'pickup', address: 'Calle 1', currency: 'MXN', subtotal: 5, total: 5, lines: [{ itemId: itemA, name: 'Croissant', qty: 2, unitPrice: 2.5 }, { itemId: itemB, name: 'Ajeno', qty: 500, unitPrice: -3 }, { name: '', qty: 1 }, 'basura'] };

await as(null);
await expectErr('anon cannot call record_order_v2', () => q(`select public.record_order_v2('tienda-a', '[]', '{}')`), 'permission denied');
await expectErr('anon cannot read orders', () => q(`select * from public.orders`), 'permission denied');
await as(A);
await expectErr('members cannot call record_order_v2', () => q(`select public.record_order_v2('tienda-a', '[]', '{}')`), 'permission denied');
await expectEq('order is saved: own products only, quantities and prices bounded, no address for pickup', async () => {
  const ok = await sendOrder(baseOrder);
  const [row] = await inbox();
  return { ok, row: { ...row, lines: row.lines.map((l) => [l.itemId === itemA, l.name, l.qty, l.unitPrice]) } };
}, { ok: true, row: { reference: 'K7Q2', status: 'new', customer_name: 'Ana', fulfillment: 'pickup', address: null, lines: [[true, 'Croissant', 2, 2.5], [false, 'Ajeno', 99, 0]], total: '5.00', partial: false, personal_data_cleared: false } });
await expectEq('same folio twice → one order', async () => { await sendOrder(baseOrder); return (await inbox()).length; }, 1);
await expectEq('the same folio days later is another order (4-character folios repeat)', async () => {
  await db.exec('reset role');
  await q(`update public.orders set created_at = now() - interval '2 days' where reference='K7Q2'`);
  await sendOrder(baseOrder);
  const count = (await inbox()).filter((o) => o.reference === 'K7Q2').length;
  await db.exec('reset role');
  await q(`delete from public.orders where reference='K7Q2' and created_at > now() - interval '1 day'`);
  await q(`update public.orders set created_at = now() where reference='K7Q2'`);
  return count;
}, 2);
await expectEq('invalid folio, malformed lines or partial flag → counted but not saved / saved safely', async () => {
  const counted = [await sendOrder({ ...baseOrder, reference: 'mal' }), await sendOrder({ ...baseOrder, reference: 'B2B2', lines: 'x' }), await sendOrder({ ...baseOrder, reference: 'C3C3', partial: 'sí', lines: [{ itemId: 'no-uuid', name: 'Pan', qty: 1 }] })];
  return { counted, refs: (await inbox()).map((o) => [o.reference, o.partial]) };
}, { counted: [true, true, true], refs: [['K7Q2', false], ['C3C3', false]] });
await setOrderSettings({ inbox: false });
await expectEq('inbox turned off → only the counters', async () => [await sendOrder({ ...baseOrder, reference: 'D4D4' }), (await inbox()).length], [true, 2]);
await setOrderSettings({ inbox: true });

await as(B);
await expectEq('other business cannot read A orders', () => q(`select count(*)::int n from public.orders where business_id=$1`, [bizA]).then((r) => r[0].n), 0);
const orderK = await asSuper(() => q(`select id from public.orders where reference='K7Q2'`).then((r) => r[0].id), 'authenticated');
await as(B);
await expectErr('other business cannot change A order status', () => q(`select public.set_order_status($1, 'confirmed')`, [orderK]), 'order_not_found');
await expectEq('other business cannot delete A orders', () => q(`delete from public.orders where id=$1 returning id`, [orderK]).then((r) => r.length), 0);
await as(A);
await expectErr('members cannot write orders directly', () => q(`update public.orders set status='delivered' where id=$1`, [orderK]), 'permission denied');
await expectErr('members cannot insert orders', () => q(`insert into public.orders(business_id, reference, lines) values ($1,'ZZZZ','[{}]')`, [bizA]), 'permission denied');
await expectErr('unknown status rejected', () => q(`select public.set_order_status($1, 'perdido')`, [orderK]), 'invalid_status');
await expectEq('confirm without stock option: stock untouched', async () => { await q(`select public.set_order_status($1, 'confirmed')`, [orderK]); return stockA(); }, '5');
await setOrderSettings({ inboxStock: true });
await as(A);
await expectEq('with stock option: confirming discounts once, cancelling returns it', async () => {
  await sendOrder({ ...baseOrder, reference: 'E5E5' });
  const id = await asSuper(() => q(`select id from public.orders where reference='E5E5'`).then((r) => r[0].id), 'authenticated');
  await as(A);
  const steps = [];
  for (const status of ['confirmed', 'ready', 'delivered']) { await q(`select public.set_order_status($1, $2)`, [id, status]); steps.push(await stockA()); }
  await q(`select public.set_order_status($1, 'cancelled')`, [id]);
  steps.push(await stockA());
  return steps;
}, ['3', '3', '3', '5']);
await expectEq('personal data is erased after 180 days (the order stays)', async () => {
  await db.exec('reset role');
  await q(`update public.orders set created_at = now() - interval '200 days' where reference='K7Q2'`);
  await sendOrder({ ...baseOrder, reference: 'F6F6' });
  const old = (await inbox()).find((o) => o.reference === 'K7Q2');
  return [old.customer_name, old.personal_data_cleared, old.lines.length];
}, [null, true, 2]);
await as(A);
await expectEq('owner deletes an order', () => q(`delete from public.orders where id=$1 returning id`, [orderK]).then((r) => r.length), 1);

/* ------------------------------------------------------------ Tipo de sitio */
// Aquí A es administrador de la plataforma y B un dueño sin permisos de administración.
const kindOf = (biz) => asSuper(() => q(`select site_kind k from public.businesses where id=$1`, [biz]).then((r) => r[0].k), 'authenticated');
await expectEq('businesses are catalogs by default', () => kindOf(bizB), 'catalog');
await as(B);
await expectErr('owner cannot change the site kind', () => q(`update public.businesses set site_kind='website' where id=$1`, [bizB]), 'permission denied');
await expectErr('owner cannot use the admin RPC', () => q(`select public.admin_set_site_kind($1, 'website')`, [bizB]), 'forbidden');
await as(A);
await expectOk('admin turns a business into a website', () => q(`select public.admin_set_site_kind($1, 'website')`, [bizB]));
await expectEq('it is a website now', () => kindOf(bizB), 'website');
await as(A);
await expectErr('unknown kind rejected', () => q(`select public.admin_set_site_kind($1, 'tienda')`, [bizB]), 'invalid_site_kind');
await expectErr('direct writes cannot bypass the check', async () => { await db.exec('reset role'); return q(`update public.businesses set site_kind='tienda' where id=$1`, [bizB]); }, 'check constraint');
await as(A);
await expectOk('admin turns it back into a catalog', () => q(`select public.admin_set_site_kind($1, 'catalog')`, [bizB]));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
