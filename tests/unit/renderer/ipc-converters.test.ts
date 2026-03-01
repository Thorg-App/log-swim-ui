import { describe, it, expect } from 'vitest'
import { convertIpcToLogEntry } from '@renderer/ipc-converters'
import type { IpcLogLine, LaneDefinition } from '@core/types'
import { createLaneDefinition } from '@core/types'

describe('convertIpcToLogEntry', () => {
  const lanes: LaneDefinition[] = [
    createLaneDefinition('error'),
    createLaneDefinition('auth')
  ]

  describe('GIVEN a valid IpcLogLine with timestamp 1705312200000', () => {
    const ipcLine: IpcLogLine = {
      rawJson: '{"level":"error","message":"something failed"}',
      fields: { level: 'error', message: 'something failed' },
      timestamp: 1705312200000,
      level: 'error'
    }

    describe('WHEN converted', () => {
      it('THEN LogEntry.timestamp is a Date matching that epoch', () => {
        const entry = convertIpcToLogEntry(ipcLine, lanes)
        expect(entry.timestamp).toEqual(new Date(1705312200000))
        expect(entry.timestamp.getTime()).toBe(1705312200000)
      })
    })
  })

  describe('GIVEN an IpcLogLine matching lane 0 regex ("error")', () => {
    const ipcLine: IpcLogLine = {
      rawJson: '{"level":"error","message":"disk full"}',
      fields: { level: 'error', message: 'disk full' },
      timestamp: 1705312200000,
      level: 'error'
    }

    describe('WHEN converted', () => {
      it('THEN laneIndex is 0', () => {
        const entry = convertIpcToLogEntry(ipcLine, lanes)
        expect(entry.laneIndex).toBe(0)
      })
    })
  })

  describe('GIVEN an IpcLogLine matching lane 1 regex ("auth")', () => {
    const ipcLine: IpcLogLine = {
      rawJson: '{"level":"info","message":"auth token refreshed"}',
      fields: { level: 'info', message: 'auth token refreshed' },
      timestamp: 1705312200000,
      level: 'info'
    }

    describe('WHEN converted', () => {
      it('THEN laneIndex is 1', () => {
        const entry = convertIpcToLogEntry(ipcLine, lanes)
        expect(entry.laneIndex).toBe(1)
      })
    })
  })

  describe('GIVEN an IpcLogLine matching no lanes', () => {
    const ipcLine: IpcLogLine = {
      rawJson: '{"level":"debug","message":"heartbeat"}',
      fields: { level: 'debug', message: 'heartbeat' },
      timestamp: 1705312200000,
      level: 'debug'
    }

    describe('WHEN converted', () => {
      it('THEN laneIndex equals lanes.length (unmatched)', () => {
        const entry = convertIpcToLogEntry(ipcLine, lanes)
        expect(entry.laneIndex).toBe(lanes.length)
      })
    })
  })

  describe('GIVEN an IpcLogLine with all fields populated', () => {
    const ipcLine: IpcLogLine = {
      rawJson: '{"level":"warn","message":"slow query"}',
      fields: { level: 'warn', message: 'slow query' },
      timestamp: 1705400000000,
      level: 'warn'
    }

    describe('WHEN converted', () => {
      it('THEN LogEntry preserves rawJson, fields, and level', () => {
        const entry = convertIpcToLogEntry(ipcLine, lanes)
        expect(entry.rawJson).toBe(ipcLine.rawJson)
        expect(entry.fields).toBe(ipcLine.fields)
        expect(entry.level).toBe('warn')
      })
    })
  })
})
