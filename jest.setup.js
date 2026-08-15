// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('@testing-library/jest-dom')

// Ensure TextEncoder/TextDecoder exist before importing undici
const { TextEncoder, TextDecoder } = require('util')
const { ReadableStream, WritableStream, TransformStream } = require('stream/web')
const { MessageChannel, MessagePort } = require('worker_threads')

if (typeof global.TextEncoder === 'undefined') {
  // @ts-ignore
  global.TextEncoder = TextEncoder
}

if (typeof global.TextDecoder === 'undefined') {
  // @ts-ignore
  global.TextDecoder = TextDecoder
}

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream
}

if (typeof global.WritableStream === 'undefined') {
  global.WritableStream = WritableStream
}

if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = TransformStream
}

// If we polyfill MessageChannel in jsdom, React's scheduler can keep a MESSAGEPORT
// handle open and prevent Jest from exiting cleanly. We only polyfill it long enough
// for any dependencies that require it, then remove it.
const didPolyfillMessageChannel = typeof global.MessageChannel === 'undefined'
if (typeof global.MessageChannel === 'undefined') {
  global.MessageChannel = MessageChannel
}

const didPolyfillMessagePort = typeof global.MessagePort === 'undefined'
if (typeof global.MessagePort === 'undefined') {
  global.MessagePort = MessagePort
}

if (typeof global.MessageEvent === 'undefined') {
  global.MessageEvent = class MessageEvent {}
}

// jsdom's `crypto` has getRandomValues but no `subtle`. Both the edge runtime
// (middleware) and Node provide Web Crypto, so code under test can rely on it —
// see src/lib/legacySessionCookie.ts, which signs the legacy session cookie.
const { webcrypto } = require('crypto')
if (typeof global.crypto === 'undefined' || typeof global.crypto.subtle === 'undefined') {
  Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true, writable: true })
}

const { fetch, Headers, Request, Response, FormData, File } = require('undici')

if (typeof global.fetch === 'undefined') {
  global.fetch = fetch
}
if (typeof global.Headers === 'undefined') {
  global.Headers = Headers
}
if (typeof global.Request === 'undefined') {
  global.Request = Request
}
if (typeof global.Response === 'undefined') {
  global.Response = Response
}
if (typeof global.FormData === 'undefined') {
  // @ts-ignore
  global.FormData = FormData
}
if (typeof global.File === 'undefined') {
  // @ts-ignore
  global.File = File
}

// Remove MessageChannel polyfills to avoid open Jest handles from React scheduler.
if (didPolyfillMessageChannel) {
  // @ts-ignore
  delete global.MessageChannel
}
if (didPolyfillMessagePort) {
  // @ts-ignore
  delete global.MessagePort
}
