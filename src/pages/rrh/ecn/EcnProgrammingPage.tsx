import React from 'react';
import { RrhProgramming } from './programming/RrhProgramming';

/**
 * ECN Route Programming Page Entry Point
 * Explicit workflow identity: ECN
 * Predecessor station: ECN IPQC
 */
export const EcnProgrammingPage: React.FC = () => {
    return <RrhProgramming routeType="ECN" />;
};

export { RrhProgramming };
export default EcnProgrammingPage;
