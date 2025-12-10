import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import styles from './Header.module.css';
import logo from '../assets/velankani-software.jpg';

interface HeaderProps {
    onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
    const { user, logout, updateUserAvatar } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const handleLogout = async () => {
        await logout();
        showToast('Logged out successfully', 'success');
        navigate('/login');
    };

    const handleAvatarClick = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showToast('Please upload a valid image file', 'error');
                return;
            }

            // Validate file size (e.g., max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image size should be less than 5MB', 'error');
                return;
            }

            try {
                if (updateUserAvatar) {
                    await updateUserAvatar(file);
                    showToast('Profile picture updated!', 'success');
                }
            } catch (error) {
                showToast('Failed to update profile picture', 'error');
            }
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    // Close menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
                !(event.target as Element).closest(`.${styles.userInfo}`)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const [isAnimating, setIsAnimating] = React.useState(false);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 60000); // Animation duration
        }, 300000); // 5 minutes

        return () => clearInterval(interval);
    }, []);

    return (
        <header className={styles.header}>
            <div className={styles.brand}>
                <div className={styles.logoContainer} onClick={() => navigate('/dashboard')}>
                    <img src={logo} alt="SFCS Logo" className={styles.brandLogo} />
                </div>
                <div
                    className={`${styles.titleContainer} ${isAnimating ? styles.vibgyorText : ''}`}
                    onClick={() => navigate('/dashboard')}
                >
                    SFCS
                </div>
                {onToggleSidebar && (
                    <div className={styles.iconContainer}>
                        <button onClick={onToggleSidebar} className={styles.menuToggleBtn} title="Toggle Sidebar">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                )}
            </div>
            <div className={styles.userSection}>
                <div className={styles.userInfo} onClick={handleAvatarClick} style={{ cursor: 'pointer' }}>
                    <img
                        src={user?.avatar || "https://ui-avatars.com/api/?name=User&background=random"}
                        alt="User"
                        className={styles.avatar}
                    />
                </div>
                <button
                    className={styles.logoutBtn}
                    onClick={handleLogout}
                    title="Logout"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>

                {isMenuOpen && (
                    <div className={styles.userMenu} ref={menuRef}>
                        <div className={styles.menuHeader}>
                            <div className={styles.menuAvatarContainer} onClick={triggerFileInput}>
                                <img
                                    src={user?.avatar || "https://ui-avatars.com/api/?name=User&background=random"}
                                    alt="User"
                                    className={styles.menuAvatar}
                                />
                                <div className={styles.avatarOverlay}>
                                    📷
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>
                            <h3 className={styles.menuName}>{user?.name || 'User'}</h3>
                            <p className={styles.menuEmail}>{user?.email}</p>
                        </div>
                        <div className={styles.menuActions}>
                            <button
                                className={`${styles.menuBtn} ${styles.changePassBtn}`}
                                onClick={() => navigate('/forgot')}
                            >
                                🔑 Change Password
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};
