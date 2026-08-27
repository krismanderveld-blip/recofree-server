declare module 'mammoth/mammoth.browser' {
  export interface RawTextResult {
    value: string;
    messages: unknown[];
  }

  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<RawTextResult>;
}
