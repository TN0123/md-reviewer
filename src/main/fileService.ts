import { readFileSync, writeFileSync } from 'fs'

export function readMarkdown(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}

export function writeMarkdown(filePath: string, content: string): void {
  writeFileSync(filePath, content, 'utf-8')
}
