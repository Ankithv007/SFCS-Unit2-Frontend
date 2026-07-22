/**
 * Centralized security helpers for frontend permission checks.
 */

/**
 * Validates that the current user has delete permission (only 'Super Admin' role is permitted).
 * Displays a uniform error toast notification if the check fails.
 * 
 * @param role The current user's role string.
 * @param showToastFn The toast function from useToast hook.
 * @returns true if user is Super Admin, false otherwise.
 */
export function checkDeletePermission(
    role: string | undefined,
    showToastFn: (msg: string, type: any) => void
): boolean {
    if (role !== 'Super Admin') {
        showToastFn(
            "Only Super Admin is authorized to delete records.\nPlease contact your Super Admin if this record needs to be deleted.",
            "error"
        );
        return false;
    }
    return true;
}
