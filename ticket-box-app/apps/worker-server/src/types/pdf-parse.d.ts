// Import subpath để tránh debug-block đọc file test trong index.js của pdf-parse.
declare module "pdf-parse/lib/pdf-parse.js" {
  function pdf(dataBuffer: Buffer | Uint8Array): Promise<{ text: string }>;
  export default pdf;
}
