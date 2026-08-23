import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

export const options = {
  vus: 5,
  duration: '30s',
  summaryTrendStats: ['avg', 'min', 'med', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const http4xx = new Counter('http_4xx');
const http429 = new Counter('http_429');
const http5xx = new Counter('http_5xx');
const endpointDuration = new Trend('endpoint_duration', true);
const endpointSizes = new Trend('endpoint_response_size', true);

const requiredEnv = [
  'BASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'STAGING_TEST_EMAIL',
  'STAGING_TEST_PASSWORD',
];

function normalizeUrl(value) {
  return value.replace(/\/$/, '');
}

function assertEnv() {
  const missing = requiredEnv.filter((name) => !__ENV[name]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function recordResponse(response, tags = {}) {
  endpointDuration.add(response.timings.duration, tags);
  endpointSizes.add(response.body ? response.body.length : 0, tags);

  if (response.status >= 400 && response.status < 500) http4xx.add(1, tags);
  if (response.status === 429) http429.add(1, tags);
  if (response.status >= 500) http5xx.add(1, tags);
}

function getJson(response, fallback) {
  try {
    return response.json();
  } catch (_) {
    return fallback;
  }
}

function restUrl(path, query) {
  const supabaseUrl = normalizeUrl(__ENV.SUPABASE_URL);
  return `${supabaseUrl}/rest/v1/${path}?${query}`;
}

function restHeaders(accessToken) {
  return {
    apikey: __ENV.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function getRest(path, query, accessToken, name) {
  const tags = { endpoint: name };
  const response = http.get(restUrl(path, query), {
    headers: restHeaders(accessToken),
    tags,
  });

  recordResponse(response, tags);

  check(response, {
    [`${name} status is 2xx`]: (res) => res.status >= 200 && res.status < 300,
  });

  return response;
}

function withFilter(query, column, value) {
  return value ? `${query}&${column}=eq.${encodeURIComponent(value)}` : query;
}

function signIn() {
  const supabaseUrl = normalizeUrl(__ENV.SUPABASE_URL);
  const response = http.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: __ENV.STAGING_TEST_EMAIL,
      password: __ENV.STAGING_TEST_PASSWORD,
    }),
    {
      headers: {
        apikey: __ENV.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      tags: { endpoint: 'auth_login' },
    },
  );

  recordResponse(response, { endpoint: 'auth_login' });

  check(response, {
    'login status is 2xx': (res) => res.status >= 200 && res.status < 300,
    'login returns access token': (res) => Boolean(getJson(res, {}).access_token),
  });

  const body = getJson(response, {});

  if (!body.access_token || !body.user?.id) {
    throw new Error('Supabase login did not return access_token and user id');
  }

  return {
    accessToken: body.access_token,
    userId: body.user.id,
  };
}

export default function () {
  assertEnv();

  const baseUrl = normalizeUrl(__ENV.BASE_URL);
  let accessToken;
  let userId;
  let empresaId;
  let cidadeId;
  let setorId;

  group('frontend', () => {
    const landingTags = { endpoint: 'frontend_landing' };
    const landing = http.get(`${baseUrl}/`, { tags: landingTags });
    recordResponse(landing, landingTags);
    check(landing, {
      'landing status is valid': (res) => res.status >= 200 && res.status < 400,
    });

    const appShellTags = { endpoint: 'frontend_app_shell' };
    const appShell = http.get(`${baseUrl}/app`, { tags: appShellTags });
    recordResponse(appShell, appShellTags);
    check(appShell, {
      'app shell status is valid': (res) => res.status >= 200 && res.status < 400,
    });
  });

  group('login', () => {
    const session = signIn();
    accessToken = session.accessToken;
    userId = session.userId;
  });

  group('profile_and_scope', () => {
    const profileQuery = `select=${encodeURIComponent('*,empresas(id,nome,slug,status)')}&id=eq.${encodeURIComponent(userId)}&limit=1`;
    const profileResponse = getRest('profiles', profileQuery, accessToken, 'profile');
    const profile = getJson(profileResponse, [])[0];
    empresaId = profile?.empresa_id;

    const cidadesResponse = getRest(
      'cidades',
      `select=${encodeURIComponent('*,empresas(id,nome)')}&order=nome.asc`,
      accessToken,
      'scope_cidades',
    );
    const cidades = getJson(cidadesResponse, []);
    cidadeId = cidades[0]?.id || null;

    const setoresResponse = getRest('setores', 'select=*&order=nome.asc', accessToken, 'scope_setores');
    const setores = getJson(setoresResponse, []);
    setorId = setores.find((setor) => !cidadeId || setor.cidade_id === cidadeId)?.id || null;
  });

  group('dashboard', () => {
    getRest(
      'equipamentos',
      withFilter(`select=${encodeURIComponent('*,setores(id,nome)')}`, 'cidade_id', cidadeId),
      accessToken,
      'dashboard_equipamentos',
    );

    getRest(
      'checklists',
      `select=${encodeURIComponent('*,equipamentos(id,codigo,nome,cidade_id)')}&order=data_prevista.desc`,
      accessToken,
      'dashboard_checklists',
    );

    getRest(
      'pendencias',
      withFilter(`select=${encodeURIComponent('*,equipamentos(id,codigo,nome)')}`, 'cidade_id', cidadeId),
      accessToken,
      'dashboard_pendencias',
    );

    getRest(
      'movimentacoes',
      withFilter(
        `select=${encodeURIComponent('*,materiais(id,codigo,nome,unidade)')}&order=criado_em.desc`,
        'cidade_id',
        cidadeId,
      ),
      accessToken,
      'dashboard_movimentacoes',
    );
  });

  group('equipamentos', () => {
    let query = `select=${encodeURIComponent('*,setores(id,nome)')}&order=codigo.asc`;
    query = withFilter(query, 'cidade_id', cidadeId);
    query = withFilter(query, 'setor_id', setorId);

    getRest('equipamentos', query, accessToken, 'equipamentos_lista_filtrada');
  });

  group('estoque', () => {
    getRest(
      'materiais',
      withFilter('select=*&order=nome.asc', 'empresa_id', empresaId),
      accessToken,
      'estoque_materiais',
    );

    getRest(
      'estoque',
      withFilter(`select=${encodeURIComponent('*,materiais(*)')}`, 'cidade_id', cidadeId),
      accessToken,
      'estoque_saldos',
    );

    getRest(
      'movimentacoes',
      withFilter(
        `select=${encodeURIComponent('*,materiais(id,codigo,nome,unidade)')}&order=criado_em.desc&limit=25`,
        'cidade_id',
        cidadeId,
      ),
      accessToken,
      'estoque_movimentacoes_recentes',
    );
  });

  group('pendencias_alertas', () => {
    getRest(
      'equipamentos',
      withFilter(`select=${encodeURIComponent('id,codigo,nome')}&order=codigo.asc`, 'cidade_id', cidadeId),
      accessToken,
      'pendencias_equipamentos',
    );

    getRest(
      'pendencias',
      withFilter(
        `select=${encodeURIComponent('*,equipamentos(id,codigo,nome)')}&order=aberta_em.desc`,
        'cidade_id',
        cidadeId,
      ),
      accessToken,
      'pendencias_lista',
    );
  });

  if (__ENV.API_URL) {
    group('api_health', () => {
      const apiUrl = normalizeUrl(__ENV.API_URL);
      const tags = { endpoint: 'api_health' };
      const response = http.get(`${apiUrl}/api/health`, { tags });
      recordResponse(response, tags);
      check(response, {
        'api health status is 2xx': (res) => res.status >= 200 && res.status < 300,
      });
    });
  }

  sleep(1);
}
