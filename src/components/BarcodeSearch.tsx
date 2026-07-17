import React, { useRef } from 'react';
import styles from './BarcodeSearch.module.css';

interface BarcodeSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const BarcodeSearch: React.FC<BarcodeSearchProps> = ({
  value,
  onChange,
  placeholder = 'Search by Serial Number or Barcode...',
  onFocus,
  onBlur,
  onKeyDown,
  onKeyPress,
  onKeyUp
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onKeyPress) {
      onKeyPress(e);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onKeyUp) {
      onKeyUp(e);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange('');
    inputRef.current?.blur();
  };

  return (
    <div className={styles.searchInputWrapper}>
      <span className={styles.searchIcon}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        onKeyPress={handleKeyPress}
        onKeyUp={handleKeyUp}
        placeholder={placeholder}
        className={styles.searchInput}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className={styles.clearButton}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  );
};
