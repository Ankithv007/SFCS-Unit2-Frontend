import React from 'react';
import { RrhPreBurnIn } from './pre-burn-in/RrhPreBurnIn';

/**
 * Non-ECN Route Pre-Burn-In Page Entry Point
 * Explicit workflow identity: Non-ECN
 * Predecessor station: Non-ECN Programming
 * Successor station: Non-ECN Hipot
 */
export const NonEcnPreBurnInPage: React.FC = () => {
    return <RrhPreBurnIn routeType="Non-ECN" />;
};

export { RrhPreBurnIn };
export default NonEcnPreBurnInPage;
