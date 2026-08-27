import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '2m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'p(50)', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const LOCAL_BASE_URL_PREFIXES = ['http://localhost:', 'http://127.0.0.1:'];
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const FORBIDDEN_SUPABASE_PROJECT_REF = 'dkldorajgrcbromgxisz';
const FORBIDDEN_ENV_PATTERNS = [
  /service[_-]?role/i,
  /supabase[_-]?service/i,
  /dkldorajgrcbromgxisz/i,
];

const requiredEnv = [
  'BASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'LOCAL_TEST_EMAIL',
  'LOCAL_TEST_PASSWORD',
];

const http4xx = new Counter('http_4xx');
const http429 = new Counter('http_429');
const http5xx = new Counter('http_5xx');
const initialLogins = new Counter('initial_logins');
const initialLoginDuration = new Trend('initial_login_duration', true);
const endpointDuration = new Trend('endpoint_duration', true);
const endpointSizes = new Trend('endpoint_response_size', true);

let vuSession;

function normalizeUrl(value) {
  return value.replace(/\/$/, '');
}

function currentStage() {
  const elapsedMs = exec.instance.currentTestRunDuration;

  if (elapsedMs < 60_000) return 'vu_10';
  if (elapsedMs < 120_000) return 'vu_25';
  if (elapsedMs < 240_000) return 'vu_50';
  if (elapsedMs < 360_000) return 'vu_100';
  return 'ramp_down';
}

function stageTags(endpoint) {
  const stage = currentStage();
  exec.vu.metrics.tags.stage = stage;

  return { endpoint, stage };
}

function assertNoForbiddenEnv() {
  const forbidden = Object.keys(__ENV).filter((name) => {
    const value = String(__ENV[name] || '');
    return FORBIDDEN_ENV_PATTERNS.some((pattern) => pattern.test(name) || pattern.test(value));
  });

  if (forbidden.length) {
    throw new Error(`Unsafe environment variables detected for local app load test: ${forbidden.join(', ')}`);
  }
}

function assertEnv() {
  const missing = requiredEnv.filter((name) => !__ENV[name]);

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  assertNoForbiddenEnv();

  const baseUrl = normalizeUrl(__ENV.BASE_URL);
  const supabaseUrl = normalizeUrl(__ENV.SUPABASE_URL);

  if (!LOCAL_BASE_URL_PREFIXES.some((prefix) => baseUrl.startsWith(prefix))) {
    throw new Error(`BASE_URL must be localhost/127.0.0.1 for this local app load test. Received: ${baseUrl}`);
  }

  if (supabaseUrl !== LOCAL_SUPABASE_URL) {
    throw new Error(`SUPABASE_URL must be ${LOCAL_SUPABASE_URL}. Received: ${supabaseUrl}`);
  }

  if (baseUrl.includes(FORBIDDEN_SUPABASE_PROJECT_REF) || supabaseUrl.includes(FORBIDDEN_SUPABASE_PROJECT_REF)) {
    throw new Error(`Production Supabase project ${FORBIDDEN_SUPABASE_PROJECT_REF} is forbidden for local app load tests`);
  }
}

function recordStatusCounters(response, tags = {}) {
  if (response.status >= 400 && response.status < 500) http4xx.add(1, tags);
  if (response.status === 429) http429.add(1, tags);
  if (response.status >= 500) http5xx.add(1, tags);
}

function recordEndpointResponse(response, tags = {}) {
  endpointDuration.add(response.timings.duration, tags);
  endpointSizes.add(response.body ? response.body.length : 0, tags);
  recordStatusCounters(response, tags);
}

function getJson(response, fallback) {
  try {
    return response.json();
  } catch (_) {
    return fallback;
  }
}

function assertNonEmpty(response, endpoint) {
  const body = getJson(response, []);
  check(response, {
    [`${endpoint} returns non-empty data`]: () => Array.isArray(body) && body.length > 0,
  });

  return body;
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

function getRest(path, query, accessToken, endpoint) {
  const tags = stageTags(endpoint);
  const response = http.get(restUrl(path, query), {
    headers: restHeaders(accessToken),
    tags,
  });

  recordEndpointResponse(response, tags);

  check(response, {
    [`${endpoint} status is 2xx`]: (res) => res.status >= 200 && res.status < 300,
  });

  if (response.status === 401) {
    vuSession = undefined;
    throw new Error(`${endpoint} returned 401; clearing VU session to avoid repeated unauthorized navigation`);
  }

  return response;
}

function withFilter(query, column, value) {
  return value ? `${query}&${column}=eq.${encodeURIComponent(value)}` : query;
}

function representativeEquipmentScope(accessToken) {
  const query = [
    `select=${encodeURIComponent('id,cidade_id,setor_id,cidades(id,nome),setores(id,nome)')}`,
    'cidade_id=not.is.null',
    'setor_id=not.is.null',
    'order=codigo.asc',
    'limit=1',
  ].join('&');

  const response = getRest('equipamentos', query, accessToken, 'scope_equipamento_com_filtros');
  const equipment = assertNonEmpty(response, 'scope_equipamento_com_filtros')[0];

  check(equipment, {
    'representative equipment has city and sector': (item) => Boolean(item?.cidade_id && item?.setor_id),
  });

  return {
    cidadeId: equipment?.cidade_id,
    setorId: equipment?.setor_id,
  };
}

function signIn() {
  const supabaseUrl = normalizeUrl(__ENV.SUPABASE_URL);
  const tags = stageTags('initial_login');
  const response = http.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({
      email: __ENV.LOCAL_TEST_EMAIL,
      password: __ENV.LOCAL_TEST_PASSWORD,
    }),
    {
      headers: {
        apikey: __ENV.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      tags,
    },
  );

  initialLogins.add(1, tags);
  initialLoginDuration.add(response.timings.duration, tags);
  recordStatusCounters(response, tags);

  check(response, {
    'initial login status is 2xx': (res) => res.status >= 200 && res.status < 300,
    'initial login returns access token': (res) => Boolean(getJson(res, {}).access_token),
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

function getVuSession() {
  if (!vuSession) {
    group('initial_login', () => {
      vuSession = signIn();
    });
  }

  return vuSession;
}

export function setup() {
  assertEnv();

  return {
    baseUrl: normalizeUrl(__ENV.BASE_URL),
  };
}

export default function (data) {
  assertEnv();

  const session = getVuSession();
  const accessToken = session.accessToken;
  const userId = session.userId;
  let empresaId;
  let cidadeId;
  let setorId;

  group('frontend', () => {
    const landingTags = stageTags('frontend_landing');
    const landing = http.get(`${data.baseUrl}/`, { tags: landingTags });
    recordEndpointResponse(landing, landingTags);
    check(landing, {
      'landing status is valid': (res) => res.status >= 200 && res.status < 400,
      'landing returns content': (res) => Boolean(res.body && res.body.length > 0),
    });

    const appShellTags = stageTags('frontend_app_shell');
    const appShell = http.get(`${data.baseUrl}/app`, { tags: appShellTags });
    recordEndpointResponse(appShell, appShellTags);
    check(appShell, {
      'app shell status is valid': (res) => res.status >= 200 && res.status < 400,
      'app shell returns content': (res) => Boolean(res.body && res.body.length > 0),
    });
  });

  group('profile_and_scope', () => {
    const profileQuery = `select=${encodeURIComponent('*,empresas(id,nome,slug,status)')}&id=eq.${encodeURIComponent(userId)}&limit=1`;
    const profileResponse = getRest('profiles', profileQuery, accessToken, 'profile');
    const profile = assertNonEmpty(profileResponse, 'profile')[0];
    empresaId = profile?.empresa_id;

    getRest(
      'cidades',
      `select=${encodeURIComponent('*,empresas(id,nome)')}&order=nome.asc`,
      accessToken,
      'scope_cidades',
    );

    getRest('setores', 'select=*&order=nome.asc', accessToken, 'scope_setores');

    const representativeScope = representativeEquipmentScope(accessToken);
    cidadeId = representativeScope.cidadeId;
    setorId = representativeScope.setorId;
  });

  group('dashboard_global', () => {
    getRest(
      'equipamentos',
      `select=${encodeURIComponent('*,setores(id,nome)')}&order=codigo.asc`,
      accessToken,
      'dashboard_global_equipamentos',
    );

    getRest(
      'checklists',
      `select=${encodeURIComponent('*,equipamentos(id,codigo,nome,cidade_id)')}&order=data_prevista.desc`,
      accessToken,
      'dashboard_global_checklists',
    );

    getRest(
      'pendencias',
      `select=${encodeURIComponent('*,equipamentos(id,codigo,nome)')}&order=aberta_em.desc`,
      accessToken,
      'dashboard_global_pendencias',
    );

    getRest(
      'movimentacoes',
      `select=${encodeURIComponent('*,materiais(id,codigo,nome,unidade)')}&order=criado_em.desc`,
      accessToken,
      'dashboard_global_movimentacoes',
    );
  });

  group('equipamentos_filtrados', () => {
    let query = `select=${encodeURIComponent('*,setores(id,nome)')}&order=codigo.asc`;
    query = withFilter(query, 'cidade_id', cidadeId);
    query = withFilter(query, 'setor_id', setorId);

    getRest('equipamentos', query, accessToken, 'equipamentos_filtrados_por_contexto_real');
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

  sleep(1);
}
