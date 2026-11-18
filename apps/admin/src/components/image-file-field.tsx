"use client";

import { useEffect, useId, useRef, useState } from "react";
import { validateImageFile } from "@/lib/image-uploads";

export function ImageFileField({
  name,
  label,
  currentUrl = "",
}: {
  name: string;
  label: string;
  currentUrl?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const reset = () => {
    if (input.current) {
      input.current.value = "";
      input.current.setCustomValidity("");
    }
    setPreview(null);
    setError(null);
  };
  return (
    <div className="management-field image-file-field">
      <label htmlFor={id}>{label}</label>
      <input type="hidden" name={name} value={currentUrl} />
      {(preview || currentUrl) && (
        <img
          className="image-file-preview"
          src={preview || currentUrl}
          alt={`Prévia: ${label}`}
        />
      )}
      <input
        ref={input}
        id={id}
        type="file"
        name={`${name}File`}
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        aria-describedby={`${id}-help`}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          const message = file ? validateImageFile(file) : null;
          event.target.setCustomValidity(message ?? "");
          setError(message);
          setPreview(file && !message ? URL.createObjectURL(file) : null);
        }}
      />
      <small id={`${id}-help`}>
        {error || "JPG ou PNG, até 2 MB. A imagem será enviada ao salvar."}
      </small>
      {(preview || error) && (
        <button type="button" className="image-file-clear" onClick={reset}>
          Limpar seleção
        </button>
      )}
    </div>
  );
}
