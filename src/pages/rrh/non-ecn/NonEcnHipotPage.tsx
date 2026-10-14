import React from 'react';
import { RrhHipot } from './hipot/RrhHipot';

/**
 * Non-ECN Route Hipot Page Entry Point
 * Explicit workflow identity: Non-ECN
 * Predecessor station: Non-ECN Pre-Burn-In
 * Successor station: Non-ECN Final Post-Burn-In
 */
export const NonEcnHipotPage: React.FC = () => {
    return <RrhHipot routeType="Non-ECN" />;
};

export { RrhHipot };
export default NonEcnHipotPage;
