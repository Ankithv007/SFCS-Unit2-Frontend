import React from 'react';
import { RrhPreBurnIn } from './pre-burn-in/RrhPreBurnIn';

/**
 * ECN Route Pre-Burn-In Page Entry Point
 * Explicit workflow identity: ECN
 * Predecessor station: ECN Programming
 */
export const EcnPreBurnInPage: React.FC = () => {
    return <RrhPreBurnIn routeType="ECN" />;
};

export { RrhPreBurnIn };
export default EcnPreBurnInPage;
