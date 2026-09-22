import React from 'react';
import styles from './RrhStationPlaceholder.module.css';

interface RrhStationPlaceholderProps {
    title: string;
    subtitle: string;
    cardTitle: string;
    sectionTitle: string;
    description: string;
    headerIcon: React.ComponentType<{ size?: number; color?: string }>;
    cardIcon: React.ComponentType<{ size?: number; color?: string }>;
    emptyIcon?: React.ComponentType<{ size?: number; color?: string }>;
}

export const RrhStationPlaceholder: React.FC<RrhStationPlaceholderProps> = ({
    title,
    subtitle,
    cardTitle,
    sectionTitle,
    description,
    headerIcon: HeaderIcon,
    cardIcon: CardIcon,
    emptyIcon: EmptyIcon = HeaderIcon,
}) => {
    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.headerTitleRow}>
                    <div className={styles.headerIcon}>
                        <HeaderIcon size={24} />
                    </div>
                    <div>
                        <h1 className={styles.headerTitle}>{title}</h1>
                        <p className={styles.headerSubtitle}>{subtitle}</p>
                    </div>
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle}>
                        <CardIcon size={20} color="#4f46e5" />
                        {cardTitle}
                    </h2>
                </div>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>
                        <EmptyIcon size={24} />
                    </div>
                    <div className={styles.emptyTitle}>{sectionTitle}</div>
                    <p className={styles.emptyDesc}>{description}</p>
                </div>
            </div>
        </div>
    );
};
