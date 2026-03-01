import { describe, it, expect } from 'vitest'
import { JsonParser } from '@core/json-parser'

describe('JsonParser.parse', () => {
  describe('GIVEN a valid JSON object string', () => {
    describe('WHEN parsed', () => {
      it('THEN returns success with fields', () => {
        const result = JsonParser.parse('{"level":"info","message":"hello"}')
        expect(result.ok).toBe(true)
      })

      it('THEN fields contain the parsed key-value pairs', () => {
        const result = JsonParser.parse('{"level":"info","message":"hello"}')
        if (!result.ok) throw new Error('Expected success')
        expect(result.fields['level']).toBe('info')
        expect(result.fields['message']).toBe('hello')
      })

      it('THEN rawJson matches the input string', () => {
        const input = '{"level":"info","message":"hello"}'
        const result = JsonParser.parse(input)
        if (!result.ok) throw new Error('Expected success')
        expect(result.rawJson).toBe(input)
      })
    })
  })

  describe('GIVEN a valid JSON array string', () => {
    describe('WHEN parsed', () => {
      it('THEN returns failure because arrays are not objects', () => {
        const result = JsonParser.parse('[1, 2, 3]')
        expect(result.ok).toBe(false)
      })

      it('THEN error indicates parsed value is not a JSON object', () => {
        const result = JsonParser.parse('[1, 2, 3]')
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toBe('Parsed value is not a JSON object')
      })
    })
  })

  describe('GIVEN malformed JSON', () => {
    describe('WHEN parsed', () => {
      it('THEN returns failure with error message', () => {
        const result = JsonParser.parse('{broken json')
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toBeTruthy()
      })

      it('THEN rawLine preserves the original input', () => {
        const input = '{broken json'
        const result = JsonParser.parse(input)
        if (result.ok) throw new Error('Expected failure')
        expect(result.rawLine).toBe(input)
      })
    })
  })

  describe('GIVEN an empty string', () => {
    describe('WHEN parsed', () => {
      it('THEN returns failure', () => {
        const result = JsonParser.parse('')
        expect(result.ok).toBe(false)
      })
    })
  })

  describe('GIVEN JSON with nested objects', () => {
    describe('WHEN parsed', () => {
      it('THEN fields contain the nested structure', () => {
        const input = '{"meta":{"host":"server1"},"level":"debug"}'
        const result = JsonParser.parse(input)
        if (!result.ok) throw new Error('Expected success')
        expect(result.fields['meta']).toEqual({ host: 'server1' })
      })
    })
  })

  describe('GIVEN a JSON primitive string like "hello"', () => {
    describe('WHEN parsed', () => {
      it('THEN returns failure because a string is not a JSON object', () => {
        const result = JsonParser.parse('"hello"')
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toBe('Parsed value is not a JSON object')
      })
    })
  })

  describe('GIVEN a JSON number like 42', () => {
    describe('WHEN parsed', () => {
      it('THEN returns failure because a number is not a JSON object', () => {
        const result = JsonParser.parse('42')
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toBe('Parsed value is not a JSON object')
      })
    })
  })

  describe('GIVEN JSON null', () => {
    describe('WHEN parsed', () => {
      it('THEN returns failure because null is not a JSON object', () => {
        const result = JsonParser.parse('null')
        expect(result.ok).toBe(false)
        if (result.ok) throw new Error('Expected failure')
        expect(result.error).toBe('Parsed value is not a JSON object')
      })
    })
  })
})
