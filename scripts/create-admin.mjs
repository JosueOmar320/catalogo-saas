/**
 * Crea (o promueve) el administrador de la plataforma.
 *
 *   npm run admin:create -- --username jefa --password "una-clave-segura" --name "Nombre"
 *
 * Usa la SERVICE ROLE (sólo en tu máquina o en un entorno seguro). No hay
 * administradores escritos en el código: el rol vive en la base de datos y
 * sólo puede cambiarlo otro administrador o este script.
 */
import { createClient } from '@supabase/supabase-js';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, i, list) => (value.startsWith('--') ? [...pairs, [value.slice(2), list[i + 1]]] : pairs), []),
);
const username = String(args.username ?? '').trim().toLowerCase();
const password = args.password ? String(args.password) : '';
const fullName = args.name ? String(args.name) : '';

if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
  console.error('Usuario inválido. Usa de 3 a 32 letras minúsculas, números, punto o guion.');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en .env.local).');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const domain = (process.env.AUTH_USERNAME_DOMAIN || 'usuarios.invalid').replace(/^@/, '');

const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
let id = existing?.id;
if (!id) {
  if (password.length < 8) {
    console.error('Para crear el usuario indica --password (mínimo 8 caracteres).');
    process.exit(1);
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: `${username}@${domain}`,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { provisioned: true, username },
  });
  if (error) {
    console.error('No se pudo crear el usuario:', error.message);
    process.exit(1);
  }
  id = data.user.id;
}
const { error } = await supabase.from('profiles').update({ platform_role: 'admin', status: 'active', ...(fullName ? { full_name: fullName } : {}) }).eq('id', id);
if (error) {
  console.error('No se pudo asignar el rol de administrador:', error.message);
  process.exit(1);
}
console.log(`✔ @${username} es administrador. Entra en /login con ese usuario.`);
