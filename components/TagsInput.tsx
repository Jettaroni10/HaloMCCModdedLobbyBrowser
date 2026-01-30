"use client";

import { useState } from "react";

type TagsInputProps = {
  name: string;
  defaultTags?: string[];
  placeholder?: string;
};

export default function TagsInput({
  name,
  defaultTags = [],
  placeholder = "Add a tag and press Enter",
}: TagsInputProps) {
  const [tags, setTags] = useState<string[]>(defaultTags);
  const [input, setInput] = useState("");

  function addTag(value: string) {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) {
      return;
    }
    setTags((prev) => [...prev, trimmed]);
  }

  function removeTag(value: string) {
    setTags((prev) => prev.filter((tag) => tag !== value));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(input);
      setInput("");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => removeTag(tag)}
            className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink hover:bg-ink/20"
          >
            {tag} ×
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={tags.join(", ")} />
      <input
        type="text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
      />
      <p className="mt-1 text-xs text-ink/50">
        Press Enter to add. Click a tag to remove.
      </p>
    </div>
  );
}
