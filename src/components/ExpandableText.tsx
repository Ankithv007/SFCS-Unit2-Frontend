import React, { useState } from 'react';
import styles from './ExpandableText.module.css';

interface ExpandableTextProps {
  text: string;
  maxLength?: number;
}

const ExpandableText: React.FC<ExpandableTextProps> = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text || text === '-' || text === 'null' || text === 'N/A') {
    return <span style={{ color: '#94a3b8' }}>-</span>;
  }

  // Determine if we should even offer an expansion
  // 40 characters is roughly 2 lines of 3-4 words
  const shouldTruncate = text.length > 35;

  if (!shouldTruncate) {
    return <span className={styles.expandableContainer}>{text}</span>;
  }

  return (
    <div className={styles.wrapper}>
      <div 
        className={isExpanded ? styles.expandedText : styles.clampedText}
        title={isExpanded ? "Click to collapse" : "Click to expand"}
      >
        {text}
        {isExpanded && (
          <button 
            className={styles.toggleBtn} 
            style={{ display: 'block', marginTop: '8px' }}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
          >
            less
          </button>
        )}
      </div>
      {!isExpanded && (
        <button 
          className={styles.toggleBtn} 
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
        >
          ...more
        </button>
      )}
    </div>
  );
};

export default ExpandableText;
