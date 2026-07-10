import React, { useState, useEffect, useRef } from 'react';
import styles from './WorkOrderSelector.module.css';

interface WorkOrderSelectorProps {
    options: any[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    valueKey?: string;
    labelKey?: string;
    productNameKey?: string;
    quantityKey?: string;
    disabled?: boolean;
    required?: boolean;
}

export const WorkOrderSelector: React.FC<WorkOrderSelectorProps> = ({
    options = [],
    value,
    onChange,
    placeholder = '-- Select Work Order --',
    valueKey = 'work_order_id',
    labelKey = 'work_order_id',
    productNameKey = 'product_name',
    quantityKey,
    disabled = false,
    required = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Find the currently selected option
    const selectedOption = options.find(opt => {
        const optVal = String(opt[valueKey] || opt[labelKey] || '');
        return optVal === value;
    });

    // Sync search query when value / selection changes
    useEffect(() => {
        if (selectedOption) {
            setSearchQuery(String(selectedOption[labelKey] || selectedOption[valueKey] || ''));
        } else {
            setSearchQuery('');
        }
    }, [value, selectedOption, valueKey, labelKey]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // Reset search query to current selected option value when blurred/closed
                if (selectedOption) {
                    setSearchQuery(String(selectedOption[labelKey] || selectedOption[valueKey] || ''));
                } else {
                    setSearchQuery('');
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedOption, valueKey, labelKey]);

    // Handle input focus/click
    const handleInputClick = () => {
        if (disabled) return;
        setIsOpen(true);
    };

    // Handle selecting an option
    const handleSelectOption = (opt: any) => {
        const val = String(opt[valueKey] || opt[labelKey] || '');
        onChange(val);
        setIsOpen(false);
    };

    // Filter and sort options based on search query
    const getFilteredOptions = () => {
        let query = searchQuery.toLowerCase().trim();
        
        // If the query is exactly the selected value, show all options on dropdown focus
        if (selectedOption) {
            const selectedVal = String(selectedOption[labelKey] || selectedOption[valueKey] || '').toLowerCase().trim();
            if (query === selectedVal) {
                query = '';
            }
        }

        if (!query) return options;

        const filtered = options.filter(opt => {
            const valStr = String(opt[valueKey] || opt[labelKey] || '').toLowerCase();
            const prodStr = String(opt[productNameKey] || '').toLowerCase();
            return valStr.includes(query) || prodStr.includes(query);
        });

        return filtered.sort((a, b) => {
            const valA = String(a[valueKey] || a[labelKey] || '').toLowerCase();
            const valB = String(b[valueKey] || b[labelKey] || '').toLowerCase();
            const prodA = String(a[productNameKey] || '').toLowerCase();
            const prodB = String(b[productNameKey] || '').toLowerCase();

            // Prioritize matching:
            // 0: Exact match on ID/WO
            // 1: Starts with on ID/WO
            // 2: Contains on ID/WO
            // 3: Starts with on Product Name
            // 4: Contains on Product Name
            // 5: Fallback
            const getScore = (val: string, prod: string) => {
                if (val === query) return 0;
                if (val.startsWith(query)) return 1;
                if (val.includes(query)) return 2;
                if (prod.startsWith(query)) return 3;
                if (prod.includes(query)) return 4;
                return 5;
            };

            const scoreA = getScore(valA, prodA);
            const scoreB = getScore(valB, prodB);

            if (scoreA !== scoreB) {
                return scoreA - scoreB;
            }
            return valA.localeCompare(valB);
        });
    };

    const filteredOptions = getFilteredOptions();

    // Determine what display text is shown inside input
    const getDisplayValue = () => {
        if (isOpen) {
            return searchQuery;
        }
        if (selectedOption) {
            const woId = String(selectedOption[labelKey] || selectedOption[valueKey] || '');
            const prodName = String(selectedOption[productNameKey] || '');
            return prodName ? `${woId} - ${prodName}` : woId;
        }
        return '';
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        setSearchQuery('');
        setIsOpen(false);
    };

    return (
        <div 
            className={`${styles.selectorContainer} ${disabled ? styles.disabled : ''}`} 
            ref={containerRef}
        >
            <div className={styles.inputWrapper} onClick={handleInputClick}>
                <input
                    type="text"
                    className={styles.selectorInput}
                    value={getDisplayValue()}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required && !value}
                />
                
                <div className={styles.iconContainer}>
                    {value && !disabled && (
                        <button 
                            type="button" 
                            className={styles.clearBtn} 
                            onClick={handleClear}
                            title="Clear selection"
                        >
                            &times;
                        </button>
                    )}
                    <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>▼</span>
                </div>
            </div>

            {isOpen && (
                <div className={styles.dropdownList}>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => {
                            const optVal = String(opt[valueKey] || opt[labelKey] || '');
                            const isSelected = optVal === value;
                            const label = String(opt[labelKey] || opt[valueKey] || '');
                            const prodName = String(opt[productNameKey] || '');
                            const qty = quantityKey ? opt[quantityKey] : null;

                            return (
                                <div
                                    key={`${optVal}-${idx}`}
                                    className={`${styles.dropdownOption} ${isSelected ? styles.selectedOption : ''}`}
                                    onClick={() => handleSelectOption(opt)}
                                >
                                    <div className={styles.optionMain}>
                                        {label} {prodName && <span className={styles.optionProd}>- {prodName}</span>}
                                    </div>
                                    {qty !== null && qty !== undefined && (
                                        <div className={styles.optionSub}>
                                            Qty: {qty}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div className={styles.noOptions}>
                            No matching work orders found
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
