import React from 'react';
import { RrhPostBurnIn } from './post-burn-in/RrhPostBurnIn';

/**
 * ECN Route Post-Burn-In Page Entry Point
 * Explicit workflow identity: ECN
 * Predecessor station: ECN Hipot
 */
export const EcnPostBurnInPage: React.FC = () => {
    return <RrhPostBurnIn routeType="ECN" />;
};

export { RrhPostBurnIn };
export default EcnPostBurnInPage;
