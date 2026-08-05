function config() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans Netlify');
  return { url, key };
}

async function request(path, options = {}) {
  const { url, key } = config();
  const baseHeaders = {
    apikey: key,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  // Les nouvelles clés sb_secret_ sont opaques : ne pas les forcer comme JWT Bearer.
  if (!key.startsWith('sb_secret_')) baseHeaders.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { ...baseHeaders, ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || String(data || response.statusText);
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  return data;
}
module.exports = { request, config };
