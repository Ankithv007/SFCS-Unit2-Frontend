import React, { useState, useEffect } from 'react';
import styles from './SearchInput.module.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'Search...' }) => {
  const [innerValue, setInnerValue] = useState(value);

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(innerValue);
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [innerValue, onChange]);

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchIcon}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <input
        type="text"
        className={styles.searchInput}
        value={innerValue}
        onChange={(e) => setInnerValue(e.target.value)}
        placeholder={placeholder}
      />
      {innerValue && (
        <button className={styles.clearButton} onClick={() => setInnerValue('')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchInput;
