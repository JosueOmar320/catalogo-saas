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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
