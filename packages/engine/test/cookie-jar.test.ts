import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cookiesFromResponse,
  mergeIntoJar,
  cookieHeaderForUrl,
  pruneExpired,
} from '../src/networking/cookie-jar.ts'
import type { JarCookie, ResponseCookie } from '../src/types/response.ts'

const NOW = Date.parse('2026-01-01T00:00:00Z')

test('a cookie with no Domain/Path becomes host-only, scoped to the request path', () => {
  const responseCookies: ResponseCookie[] = [{ name: 'session', value: 'abc123' }]
  const [cookie] = cookiesFromResponse(responseCookies, 'https://api.acme.dev/v1/auth/login', NOW)
  assert.equal(cookie.domain, 'api.acme.dev')
  assert.equal(cookie.hostOnly, true)
  assert.equal(cookie.path, '/v1/auth') // default-path: request path up to its last '/'
})

test('an explicit Domain attribute produces a non-host-only cookie, leading dot stripped', () => {
  const responseCookies: ResponseCookie[] = [{ name: 'session', value: 'abc123', domain: '.acme.dev', path: '/' }]
  const [cookie] = cookiesFromResponse(responseCookies, 'https://api.acme.dev/v1/login', NOW)
  assert.equal(cookie.domain, 'acme.dev')
  assert.equal(cookie.hostOnly, false)
  assert.equal(cookie.path, '/')
})

test('Max-Age takes precedence over Expires and resolves to an absolute timestamp', () => {
  const responseCookies: ResponseCookie[] = [
    { name: 'session', value: 'abc', maxAge: 3600, expires: 'Wed, 01 Jan 2020 00:00:00 GMT' },
  ]
  const [cookie] = cookiesFromResponse(responseCookies, 'https://api.acme.dev/v1', NOW)
  assert.equal(cookie.expiresAt, NOW + 3600 * 1000)
})

test('a deletion cookie (Max-Age=0 / already-expired) never enters the jar', () => {
  const responseCookies: ResponseCookie[] = [{ name: 'session', value: '', maxAge: 0 }]
  const result = cookiesFromResponse(responseCookies, 'https://api.acme.dev/v1', NOW)
  assert.equal(result.length, 0)
})

test('a session cookie (no Max-Age/Expires) has no expiresAt and never gets pruned', () => {
  const responseCookies: ResponseCookie[] = [{ name: 'session', value: 'abc' }]
  const [cookie] = cookiesFromResponse(responseCookies, 'https://api.acme.dev/v1', NOW)
  assert.equal(cookie.expiresAt, undefined)
  const pruned = pruneExpired([cookie], NOW + 1000 * 60 * 60 * 24 * 365 * 10)
  assert.equal(pruned.length, 1)
})

test('mergeIntoJar replaces same name+domain+path, keeps everything else, prunes expired', () => {
  const stale: JarCookie = {
    name: 'session',
    value: 'old',
    domain: 'api.acme.dev',
    hostOnly: true,
    path: '/',
    secure: false,
    httpOnly: false,
    createdAt: NOW - 1000,
  }
  const unrelated: JarCookie = {
    name: 'theme',
    value: 'dark',
    domain: 'api.acme.dev',
    hostOnly: true,
    path: '/',
    secure: false,
    httpOnly: false,
    createdAt: NOW - 1000,
  }
  const expired: JarCookie = {
    name: 'old-session',
    value: 'gone',
    domain: 'api.acme.dev',
    hostOnly: true,
    path: '/',
    secure: false,
    httpOnly: false,
    expiresAt: NOW - 1,
    createdAt: NOW - 5000,
  }
  const fresh = cookiesFromResponse([{ name: 'session', value: 'new' }], 'https://api.acme.dev/', NOW)
  const merged = mergeIntoJar([stale, unrelated, expired], fresh, NOW)
  assert.equal(merged.length, 2)
  assert.ok(merged.some((c) => c.name === 'session' && c.value === 'new'))
  assert.ok(merged.some((c) => c.name === 'theme'))
  assert.ok(!merged.some((c) => c.name === 'old-session'))
})

test('cookieHeaderForUrl matches host-only cookies to the exact host only', () => {
  const jar = cookiesFromResponse([{ name: 'session', value: 'abc' }], 'https://api.acme.dev/', NOW)
  assert.equal(cookieHeaderForUrl(jar, 'https://api.acme.dev/v1/users', NOW), 'session=abc')
  assert.equal(cookieHeaderForUrl(jar, 'https://sub.api.acme.dev/v1/users', NOW), undefined)
  assert.equal(cookieHeaderForUrl(jar, 'https://other.dev/v1/users', NOW), undefined)
})

test('cookieHeaderForUrl lets a Domain-attribute cookie match subdomains too', () => {
  const jar = cookiesFromResponse(
    [{ name: 'session', value: 'abc', domain: 'acme.dev' }],
    'https://api.acme.dev/',
    NOW
  )
  assert.equal(cookieHeaderForUrl(jar, 'https://api.acme.dev/x', NOW), 'session=abc')
  assert.equal(cookieHeaderForUrl(jar, 'https://other.acme.dev/x', NOW), 'session=abc')
  assert.equal(cookieHeaderForUrl(jar, 'https://acme.dev/x', NOW), 'session=abc')
})

test('cookieHeaderForUrl respects path scoping', () => {
  const jar = cookiesFromResponse([{ name: 'admin', value: '1', path: '/admin' }], 'https://acme.dev/admin/x', NOW)
  assert.equal(cookieHeaderForUrl(jar, 'https://acme.dev/admin/dashboard', NOW), 'admin=1')
  assert.equal(cookieHeaderForUrl(jar, 'https://acme.dev/public', NOW), undefined)
})

test('cookieHeaderForUrl withholds a Secure cookie from a plain http request', () => {
  const jar = cookiesFromResponse([{ name: 'session', value: 'abc', secure: true }], 'https://acme.dev/', NOW)
  assert.equal(cookieHeaderForUrl(jar, 'http://acme.dev/', NOW), undefined)
  assert.equal(cookieHeaderForUrl(jar, 'https://acme.dev/', NOW), 'session=abc')
})

test('cookieHeaderForUrl never sends an expired cookie', () => {
  const jar = cookiesFromResponse([{ name: 'session', value: 'abc', maxAge: 1 }], 'https://acme.dev/', NOW)
  assert.equal(cookieHeaderForUrl(jar, 'https://acme.dev/', NOW + 2000), undefined)
})

test('cookieHeaderForUrl joins multiple matching cookies with "; "', () => {
  const jar = mergeIntoJar(
    [],
    [
      ...cookiesFromResponse([{ name: 'a', value: '1' }], 'https://acme.dev/', NOW),
      ...cookiesFromResponse([{ name: 'b', value: '2' }], 'https://acme.dev/', NOW),
    ],
    NOW
  )
  const header = cookieHeaderForUrl(jar, 'https://acme.dev/', NOW)
  assert.ok(header === 'a=1; b=2' || header === 'b=2; a=1')
})
