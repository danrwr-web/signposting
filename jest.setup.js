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

if (typeof global.MessageChannel === 'undefined') {
  global.MessageChannel = MessageChannel
}

if (typeof global.MessagePort === 'undefined') {
  global.MessagePort = MessagePort
}

if (typeof global.MessageEvent === 'undefined') {
  global.MessageEvent = class MessageEvent {}
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
