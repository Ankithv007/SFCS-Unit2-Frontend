import React from 'react';
import { RrhPostBurnIn } from './post-burn-in/RrhPostBurnIn';

/**
 * Non-ECN Route Final Post-Burn-In Page Entry Point
 * Explicit workflow identity: Non-ECN
 * Predecessor station: Non-ECN Hipot
 * Distinguishable from Initial Post-Burn-In in station identity, title, and API calls
 */
export const NonEcnFinalPostBurnInPage: React.FC = () => {
    return (
        <RrhPostBurnIn
            routeType="Non-ECN"
            customTitle="RRH Post-Burn-in Test (Final)"
        />
    );
};

export { RrhPostBurnIn };
export default NonEcnFinalPostBurnInPage;
