import { useState, useEffect, useRef } from 'react';
import styles from './WorkOrderCombobox.module.css';
import { apiFetch } from '../utils/api';

export interface WorkOrderOption {
  id: string;
  product_name?: string;
  quantity?: number;
  status?: string;
  model_name?: string;
  po_id?: string;
}

interface WorkOrderComboboxProps {
  selectedWorkOrderId: string | null;
  onSelectWorkOrder: (workOrderId: string) => void;
  onClear?: () => void;
}

export function WorkOrderCombobox({
  selectedWorkOrderId,
  onSelectWorkOrder,
  onClear
}: WorkOrderComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<WorkOrderOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced server-side search
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const queryParam = encodeURIComponent(searchQuery.trim());
        const data = await apiFetch(`/api/smt/admin/work-orders/search?q=${queryParam}`);
        if (data && data.success && Array.isArray(data.workOrders)) {
          setOptions(data.workOrders);
        } else {
          setOptions([]);
        }
      } catch (err) {
        console.error('Failed to search Work Orders:', err);
        setOptions([]);
      } finally {
        setIsLoading(false);
        setHighlightedIndex(0);
      }
    }, 350); // 350ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (options[highlightedIndex]) {
          handleSelect(options[highlightedIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (woId: string) => {
    onSelectWorkOrder(woId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) onClear();
    setSearchQuery('');
  };

  return (
    <div className={styles.comboboxContainer} ref={containerRef} onKeyDown={handleKeyDown}>
      {/* Combobox Trigger Button */}
      <button
        type="button"
        className={styles.triggerButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className={styles.triggerText}>
          🔍 {selectedWorkOrderId ? (
            <strong>{selectedWorkOrderId}</strong>
          ) : (
            <span className={styles.placeholder}>Search or select Work Order...</span>
          )}
        </span>

        <span className={styles.actions}>
          {selectedWorkOrderId && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClear}
              title="Clear Selection"
            >
              ✕
            </button>
          )}
          <span>{isOpen ? '▲' : '▼'}</span>
        </span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={styles.dropdownPanel}>
          <div className={styles.searchHeader}>
            <input
              ref={inputRef}
              type="text"
              className={styles.searchInput}
              placeholder="🔍 Type Work Order ID, Product Code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className={styles.loadingState}>Searching...</div>
          ) : options.length === 0 ? (
            <div className={styles.emptyState}>No Work Orders Found</div>
          ) : (
            <ul className={styles.optionsList} role="listbox">
              {options.map((opt, idx) => {
                const isSelected = opt.id === selectedWorkOrderId;
                const isHighlighted = idx === highlightedIndex;
                const statusLower = (opt.status || '').toLowerCase();
                let statusClass = styles.statusNotStarted;
                if (statusLower.includes('completed')) statusClass = styles.statusCompleted;
                else if (statusLower.includes('progress') || statusLower.includes('created')) statusClass = styles.statusInProgress;

                return (
                  <li
                    key={opt.id}
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.optionItem} ${isHighlighted ? styles.highlighted : ''} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleSelect(opt.id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <div className={styles.optionMain}>
                      <span className={styles.optionId}>{opt.id}</span>
                      <span className={`${styles.optionStatus} ${statusClass}`}>{opt.status || 'Active'}</span>
                    </div>
                    {(opt.product_name || opt.quantity) && (
                      <div className={styles.optionSub}>
                        {opt.product_name || 'Product'} {opt.quantity ? `(Qty: ${opt.quantity})` : ''}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
