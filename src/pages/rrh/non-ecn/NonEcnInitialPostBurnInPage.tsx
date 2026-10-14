import React from 'react';
import { RrhPostBurnInInitial } from './post-burn-in-initial/RrhPostBurnInInitial';

/**
 * Non-ECN Route Initial Post-Burn-In Page Entry Point
 * Explicit workflow identity: Non-ECN
 * Predecessor station: IVI (route='NON_ECN', bypasses IPQC)
 * Successor station: Non-ECN Programming
 */
export const NonEcnInitialPostBurnInPage: React.FC = () => {
    return (
        <RrhPostBurnInInitial
            routeType="Non-ECN"
            customTitle="RRH Post-Burn-in Test (Initial)"
        />
    );
};

export { RrhPostBurnInInitial };
export default NonEcnInitialPostBurnInPage;
