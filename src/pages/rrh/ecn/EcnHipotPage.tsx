import React from 'react';
import { RrhHipot } from './hipot/RrhHipot';

/**
 * ECN Route Hipot Page Entry Point
 * Explicit workflow identity: ECN
 * Predecessor station: ECN Pre-Burn-In
 */
export const EcnHipotPage: React.FC = () => {
    return <RrhHipot routeType="ECN" />;
};

export { RrhHipot };
export default EcnHipotPage;
