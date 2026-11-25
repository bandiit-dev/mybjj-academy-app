"use client";

import { useAction } from "convex/react";
import { useRef } from "react";
import { api } from "@mybjj/backend/convex/_generated/api";
import type { Id } from "@mybjj/backend/convex/_generated/dataModel";
import { MAX_IMAGE_BYTES } from "@mybjj/backend/convex/lib/imageValidation";

export function validateImageFile(file: File): string | null {
  if (
    !/\.(jpe?g|png)$/i.test(file.name) ||
    (file.type && !["image/jpeg", "image/png"].includes(file.type))
  ) {
    return "Selecione uma imagem JPG ou PNG.";
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    return "A imagem deve ter até 2 MB.";
  return null;
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(
        new Error(
          "Não foi possível ler a imagem. Selecione o arquivo novamente.",
        ),
      );
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(file);
  });
}

async function imageUploadArgs(file: File) {
  const error = validateImageFile(file);
  if (error) throw new Error(error);
  return {
    base64: await readBase64(file),
    contentType: file.type || (/\.png$/i.test(file.name) ? "image/png" : "image/jpeg"),
    fileName: file.name,
  };
}

export function useImageUpload() {
  const upload = useAction(api.images.uploadBase64);
  const cache = useRef(new Map<File, Promise<string>>());
  return async (data: FormData, name: string): Promise<string> => {
    const file = data.get(`${name}File`);
    if (!(file instanceof File) || !file.size)
      return String(data.get(name) ?? "");
    let result = cache.current.get(file);
    if (!result) {
      result = imageUploadArgs(file).then(upload).then((image) => image.url);
      cache.current.set(file, result);
    }
    try {
      return await result;
    } catch (cause) {
      cache.current.delete(file);
      throw cause;
    }
  };
}

export function useStudentPhotoUpload() {
  const upload = useAction(api.studentPhotos.upload);
  return async (data: FormData, gymId: Id<"gyms">) => {
    const file = data.get("pictureFile");
    if (file instanceof File && file.size) {
      return upload({ ...await imageUploadArgs(file), gymId });
    }
  };
}
