import React from 'react';
import { RrhProgramming } from './programming/RrhProgramming';

/**
 * Non-ECN Route Programming Page Entry Point
 * Explicit workflow identity: Non-ECN
 * Predecessor station: Non-ECN Initial Post-Burn-In (bypasses ECN IPQC)
 * Successor station: Non-ECN Pre-Burn-In
 */
export const NonEcnProgrammingPage: React.FC = () => {
    return <RrhProgramming routeType="Non-ECN" />;
};

export { RrhProgramming };
export default NonEcnProgrammingPage;
