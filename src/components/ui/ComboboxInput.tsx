"use client";

import { useState, useRef } from "react";

export interface ComboboxInputProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ComboboxInput({ options, value, onChange, disabled = false, placeholder, className }: ComboboxInputProps) {
  // "Other" mode: value exists but isn't in the known options list
  const [isOtherMode, setIsOtherMode] = useState(() => !!value && !options.includes(value));
  const [otherValue, setOtherValue] = useState(() => (value && !options.includes(value) ? value : ""));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  const [listboxId] = useState(() => `combobox-list-${Math.random().toString(36).slice(2)}`);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const inputClasses =
    "w-full rounded-md border border-ps-border-strong bg-ps-surface px-3 py-2 text-sm text-ps-text placeholder:text-ps-text-ter focus:border-ps-amber focus:outline-none focus:ring-1 focus:ring-ps-amber disabled:opacity-50 disabled:cursor-not-allowed";

  function handleFocus() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function handleBlur() {
    setOpen(false);
    setQuery("");
  }

  function handleSelect(opt: string) {
    onChange(opt);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleSelectOther() {
    setIsOtherMode(true);
    setOpen(false);
    setQuery("");
    setTimeout(() => otherRef.current?.focus(), 0);
  }

  function handleBackToList() {
    setIsOtherMode(false);
    setOtherValue("");
    onChange("");
  }

  if (isOtherMode) {
    return (
      <div className={`space-y-1.5${className ? ` ${className}` : ""}`}>
        <input
          ref={otherRef}
          type="text"
          value={otherValue}
          onChange={(e) => {
            setOtherValue(e.target.value);
            onChange(e.target.value);
          }}
          disabled={disabled}
          placeholder="Enter name..."
          className={inputClasses}
        />
        {!disabled && (
          <button
            type="button"
            onClick={handleBackToList}
            className="text-xs text-ps-text-ter hover:text-ps-text underline"
          >
            ← Back to list
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`relative${className ? ` ${className}` : ""}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        autoComplete="off"
        disabled={disabled}
        placeholder={value || placeholder || "Select an option"}
        value={open ? query : value}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={inputClasses}
      />
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-ps-border bg-ps-surface shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ps-text-ter italic">No matches</li>
          )}
          {filtered.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${
                opt === value
                  ? "bg-ps-amber-soft font-medium text-ps-text"
                  : "text-ps-text-sec hover:bg-ps-chip"
              }`}
            >
              {opt}
            </li>
          ))}
          <li
            role="option"
            aria-selected={false}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelectOther();
            }}
            className="cursor-pointer border-t border-ps-border px-3 py-2 text-sm text-ps-text-ter hover:bg-ps-chip"
          >
            Other...
          </li>
        </ul>
      )}
    </div>
  );
}
