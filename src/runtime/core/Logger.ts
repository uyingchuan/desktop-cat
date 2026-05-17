export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(scope: string, message: string, data?: unknown): void
  info(scope: string, message: string, data?: unknown): void
  warn(scope: string, message: string, data?: unknown): void
  error(scope: string, message: string, err?: Error): void
  runtime(name: string): Logger
}

export class ConsoleLogger implements Logger {
  private prefix: string

  constructor(prefix = '') {
    this.prefix = prefix
  }

  private fmt(level: LogLevel, scope: string, message: string): string {
    const ts = new Date().toISOString().slice(11, 23)
    return `[${ts}][${level.toUpperCase()}][${this.prefix}${scope}] ${message}`
  }

  debug(scope: string, message: string, data?: unknown): void {
    console.debug(this.fmt('debug', scope, message), data ?? '')
  }

  info(scope: string, message: string, data?: unknown): void {
    console.info(this.fmt('info', scope, message), data ?? '')
  }

  warn(scope: string, message: string, data?: unknown): void {
    console.warn(this.fmt('warn', scope, message), data ?? '')
  }

  error(scope: string, message: string, err?: Error): void {
    console.error(this.fmt('error', scope, message), err ?? '')
  }

  runtime(name: string): Logger {
    return new ConsoleLogger(`${name}:`)
  }
}
