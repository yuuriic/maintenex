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
const authLoginDuration = new Trend('auth_login', true);
const endpointDuration = new Trend('endpoint_duration', true);
const endpointSizes = new Trend('endpoint_response_size', true);

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
    throw new Error(`Unsafe environment variables detected for local auth load test: ${forbidden.join(', ')}`);
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
    throw new Error(`BASE_URL must be localhost/127.0.0.1 for this local auth load test. Received: ${baseUrl}`);
  }

  if (supabaseUrl !== LOCAL_SUPABASE_URL) {
    throw new Error(`SUPABASE_URL must be ${LOCAL_SUPABASE_URL}. Received: ${supabaseUrl}`);
  }

  if (baseUrl.includes(FORBIDDEN_SUPABASE_PROJECT_REF) || supabaseUrl.includes(FORBIDDEN_SUPABASE_PROJECT_REF)) {
    throw new Error(`Production Supabase project ${FORBIDDEN_SUPABASE_PROJECT_REF} is forbidden for local auth load tests`);
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

function signIn() {
  const supabaseUrl = normalizeUrl(__ENV.SUPABASE_URL);
  const tags = stageTags('auth_login');
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

  authLoginDuration.add(response.timings.duration, tags);
  recordResponse(response, tags);

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

export function setup() {
  assertEnv();

  return {};
}

export default function () {
  assertEnv();

  group('auth_login', () => {
    signIn();
  });

  sleep(1);
}
