declare module "@mapbox/togeojson" {
  export function kml(document: Document): unknown
  export function gpx(document: Document): unknown
}

declare module "qrcode" {
  type QRCodeOptions = Record<string, unknown>
  const QRCode: {
    toDataURL(text: string, options?: QRCodeOptions): Promise<string>
  }
  export default QRCode
}

declare module "papaparse" {
  export interface ParseError {
    message: string
    code?: string
    type?: string
    row?: number
  }

  export interface ParseResult<T> {
    data: T[]
    errors: ParseError[]
    meta: Record<string, unknown>
  }

  export interface ParseConfig<T> {
    complete?: (results: ParseResult<T>) => void
    error?: (error: Error) => void
  }

  const Papa: {
    parse<T = unknown>(input: File | string, config: ParseConfig<T>): void
  }

  export default Papa
}
