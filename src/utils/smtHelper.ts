/**
 * Validates compatibility between Work Order side and Stencil side.
 * Compatibility Matrix:
 * - TOP WO: TOP stencil only
 * - BOTTOM WO: BOTTOM stencil only
 * - TOP/BOTTOM WO (or sides containing '/'): TOP, BOTTOM, or TOP/BOTTOM stencil
 */
export const isStencilSideCompatible = (woSideRaw: string | null | undefined, stencilSideRaw: string | null | undefined): boolean => {
    if (!woSideRaw || !stencilSideRaw) return false;

    const normWOSide = woSideRaw.trim().toUpperCase().replace(/\s*\/\s*/g, '/');
    const normStencilSide = stencilSideRaw.trim().toUpperCase().replace(/\s*\/\s*/g, '/');

    if (normWOSide === 'TOP') {
        return normStencilSide === 'TOP';
    }
    if (normWOSide === 'BOTTOM') {
        return normStencilSide === 'BOTTOM';
    }
    if (normWOSide === 'TOP/BOTTOM' || normWOSide.includes('/')) {
        return normStencilSide === 'TOP' || normStencilSide === 'BOTTOM' || normStencilSide === 'TOP/BOTTOM';
    }

    return normWOSide === normStencilSide;
};

/**
 * Calculates the required stencil lifecycle prints based on Work Order side, Stencil side, and Panel Quantity.
 * 
 * Rules:
 * - IF Work Order Side = TOP -> Required Prints = Panel Quantity
 * - IF Work Order Side = BOTTOM -> Required Prints = Panel Quantity
 * - IF Work Order Side = TOP/BOTTOM AND Stencil Side = TOP -> Required Prints = Panel Quantity
 * - IF Work Order Side = TOP/BOTTOM AND Stencil Side = BOTTOM -> Required Prints = Panel Quantity
 * - IF Work Order Side = TOP/BOTTOM AND Stencil Side = TOP/BOTTOM -> Required Prints = Panel Quantity × 2
 */
export const calculateRequiredLifecyclePrints = (
    woSideRaw: string | null | undefined,
    stencilSideRaw: string | null | undefined,
    panelQuantity: number
): number => {
    const pQty = Math.max(0, Number(panelQuantity) || 0);
    if (!woSideRaw || !stencilSideRaw) return pQty;

    const normWOSide = woSideRaw.trim().toUpperCase().replace(/\s*\/\s*/g, '/');
    const normStencilSide = stencilSideRaw.trim().toUpperCase().replace(/\s*\/\s*/g, '/');

    if (normWOSide === 'TOP/BOTTOM' || normWOSide.includes('/')) {
        if (normStencilSide === 'TOP/BOTTOM' || normStencilSide.includes('/')) {
            return pQty * 2;
        }
        return pQty;
    }

    return pQty;
};
