import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, ApiUnavailable, registerPlayer } from './api.ts'

/** Stands in for the network, so the client's error handling can be exercised. */
function withFetch(response: () => Promise<Response>, run: () => Promise<void>) {
  const original = globalThis.fetch
  globalThis.fetch = response as typeof fetch
  return run().finally(() => {
    globalThis.fetch = original
  })
}

const respond = (body: string, status: number, type = 'application/json') =>
  async () => new Response(body, { status, headers: { 'content-type': type } })

test('an error from our own routes is passed through', async () => {
  await withFetch(respond('{"error":"nickname is taken"}', 400), async () => {
    await assert.rejects(registerPlayer('burning'), (error: Error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.message, 'nickname is taken')
      return true
    })
  })
})

test("a proxy's object-shaped error is unwrapped, not stringified", async () => {
  // Vercel's deployment protection answers like this; the naive read gives
  // "[object Object]".
  const protection = '{"error":{"message":"Protected deployment","code":"401"}}'
  await withFetch(respond(protection, 401), async () => {
    await assert.rejects(registerPlayer('burning'), (error: Error) => {
      assert.match(error.message, /preview deployment is password-protected/)
      return true
    })
  })
})

test('an unrecognised error body still names the status', async () => {
  await withFetch(respond('{"unexpected":true}', 503), async () => {
    await assert.rejects(registerPlayer('burning'), (error: Error) => {
      assert.equal(error.message, 'request failed (503)')
      return true
    })
  })
})

test('an HTML response means there is no API here', async () => {
  // A deploy without the routes serves the SPA's index.html for /api/* too.
  await withFetch(respond('<!doctype html><html></html>', 200, 'text/html'), async () => {
    await assert.rejects(registerPlayer('burning'), (error: Error) => {
      assert.ok(error instanceof ApiUnavailable)
      assert.match(error.message, /not available on this deployment/)
      return true
    })
  })
})

test('a crashing function is told apart from a missing one', async () => {
  await withFetch(respond('Internal Server Error', 500, 'text/plain'), async () => {
    await assert.rejects(registerPlayer('burning'), (error: Error) => {
      assert.ok(error instanceof ApiUnavailable)
      assert.match(error.message, /returned 500 instead of JSON/)
      return true
    })
  })
})

test('an unreachable network is not mistaken for a server error', async () => {
  await withFetch(
    async () => {
      throw new TypeError('Failed to fetch')
    },
    async () => {
      await assert.rejects(registerPlayer('burning'), (error: Error) => {
        assert.ok(error instanceof ApiUnavailable)
        return true
      })
    },
  )
})
