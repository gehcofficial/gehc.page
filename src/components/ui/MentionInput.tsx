import React, { useState, useRef, useEffect, useCallback } from 'react';

interface UserSuggestion {
  id: string;
  name: string;
  email?: string;
  division?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  className = '',
  disabled = false,
}) => {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch user suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        credentials: 'include',
      });
      if (r.ok) {
        const d = await r.json();
        setSuggestions(d.users || []);
        setShowSuggestions(true);
        setSelectedIndex(0);
      }
    } catch { /* skip */ }
    finally { setLoading(false); }
  }, []);

  // Handle input change — detect @ mentions
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Detect @ trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      const searchQuery = atMatch[1];
      setQuery(searchQuery);
      fetchSuggestions(searchQuery);
    } else {
      setShowSuggestions(false);
      setQuery('');
    }
  };

  // Insert mention
  const insertMention = (user: UserSuggestion) => {
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);

    // Find the @ trigger position
    const atPos = textBeforeCursor.lastIndexOf('@');
    if (atPos === -1) return;

    const beforeAt = value.slice(0, atPos);
    const mention = `@${user.name}`;
    const newValue = `${beforeAt}${mention} ${textAfterCursor}`;

    onChange(newValue);
    setShowSuggestions(false);
    setQuery('');

    // Focus back on textarea
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = beforeAt.length + mention.length + 1;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        inputRef.current.focus();
      }
    }, 0);
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          insertMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />

      {/* Mention dropdown */}
      {showSuggestions && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bottom-full left-0 w-64 mb-1 bg-white rounded-xl border border-[#D9D7D0] shadow-lg overflow-hidden"
        >
          {loading ? (
            <div className="p-3 text-xs text-[#8C8880] text-center">Mencari...</div>
          ) : suggestions.length === 0 ? (
            <div className="p-3 text-xs text-[#8C8880] text-center">Tidak ditemukan</div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {suggestions.map((user, i) => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                    i === selectedIndex ? 'bg-[#FAF9F5]' : 'hover:bg-[#FAF9F5]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-[#D9D7D0] flex items-center justify-center text-[10px] font-bold text-[#8C8880] shrink-0">
                    {(user.name || '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1B1B1B] truncate">{user.name}</p>
                    {user.division && (
                      <p className="text-[10px] text-[#8C8880] truncate">{user.division}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Parse mention text and render with highlighted @mentions.
 */
export function renderMentionText(text: string): React.ReactNode[] {
  const parts = text.split(/(@\w[\w\s]*?\w(?=\s|$|[^a-zA-Z0-9]))/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-xs">
          {part}
        </span>
      );
    }
    return part;
  });
}
