export function isImage(value: string): boolean {
  return /\.(?:jpe?g|png|webp|avif|gif|svg|bmp|ico|tiff?|heic|apng)$/i.test(value)
}

export function inBetween(value: number, minimum: number, maximum: number): boolean {
  return value >= minimum && value <= maximum
}
