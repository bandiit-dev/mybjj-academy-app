export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png"] as const;

export function decodeImageBase64(base64: string, contentType: string): Uint8Array<ArrayBuffer> {
  if (!IMAGE_CONTENT_TYPES.includes(contentType as typeof IMAGE_CONTENT_TYPES[number])) {
    throw new Error("Selecione uma imagem JPG ou PNG.");
  }
  if (!base64 || base64.length > 4 * Math.ceil(MAX_IMAGE_BYTES / 3)) {
    throw new Error("A imagem deve ter até 2 MB.");
  }
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error("Imagem inválida. Selecione outro arquivo JPG ou PNG.");
  }
  const binary = atob(base64);
  if (!binary.length || binary.length > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter até 2 MB.");
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 &&
    bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  if ((contentType === "image/png" && !png) || (contentType === "image/jpeg" && !jpeg)) {
    throw new Error("O conteúdo do arquivo não corresponde a uma imagem JPG ou PNG.");
  }
  return bytes;
}
