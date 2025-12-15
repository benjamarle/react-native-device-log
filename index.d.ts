import * as React from 'react';
import { ViewStyle } from 'react-native';

declare var deviceLog: DebugService

export const LogView: React.ComponentType<LogViewProps>

export enum LogLevel {
    log = "log",
    debug = "debug",
    info = "info",
    fatal = "fatal",
    success = "success",
    rnerror = "rnerror",
    separator = "separator"
}


export type Color = string

export interface DebugServiceOptions {
    logToConsole: boolean,
    logToConsoleMethod: 'match' | undefined,
    logToConsoleFunc: (LogLevel, Color, string) => void,
    logRNErrors: boolean,
    maxNumberToRender: number,
    maxNumberToPersist: number,
    rowInsertDebounceMs: number,
    logAppState: boolean,
    logConnection: boolean,
    hideSystemLogs: boolean,
}

export interface StorageAdapter {

}

export interface LogRow {
    id: string,
    lengthAtInsertion: number,
    level: LogLevel,
    message: string,
    timeStamp: string,
    color: string
}

export interface Store {
    setReadOnly(readOnly)

    async getRows(): Promise<LogRow[]>

    async insertRows(logRows: LogRow[], allRows: LogRow[]): Promise<LogRow[]>

    async clear(): Promise<void>

    logRowCreated?()

    appendToLogRow?(logRow: LogRow): LogRow

    async initalDataRead?(logRows: LogRow[])
}

export interface DebugService {
    store: Store

    async init(StorageAdapter, DebugServiceOptions): Promise<void>

    stopTimer(name: string)

    async startTimer(name: string)

    async logTime(name: string): Promise<void>

    async clear(): Promise<void>

    log(...logRows: string[]): Promise<void>

    debug(...logRows: string[]): Promise<void>

    info(...logRows: string[]): Promise<void>

    error(...logRows: string[]): Promise<void>

    fatal(...logRows: string[]): Promise<void>

    success(...logRows: string[]): Promise<void>

    rnerror(fatal: boolean, message: string, stackTraceItems: StackTraceItem[]): string

    separator(name): Promise<void>

    getColorForLogLevel(level: LogLevel): Color

    logToConsole(level: LogLevel, color: Color, ...logRows: string[]): void

    onDebugRowsChanged(callback: (rows: LogRow[]) => void): () => void

}

export interface LogViewProps {
    inverted?: boolean
    multiExpanded?: boolean
    timeStampFormat?: string
    renderTimestamp?: boolean
    renderLevel?: boolean
    paused?: boolean
    textColor?: string
    backgroundColor?: string
    borderColor?: string
    separatorColor?: string
    renderToolbar?: (options: ToolbarOptions) => React.ReactNode
}

export interface ToolbarOptions {
    onPause: () => void
    onClear: () => void
    onFilter: () => void
    length: any[]
}

export const debugListView: React.ComponentType<any>

export { deviceLog }