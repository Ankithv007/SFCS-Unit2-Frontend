import React from 'react';
import { Thermometer, CheckCircle2 } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

interface RrhPostBurnInProps {
    routeType?: 'ECN' | 'Non-ECN';
    customTitle?: string;
}

export const RrhPostBurnIn: React.FC<RrhPostBurnInProps> = ({ routeType, customTitle }) => (
    <RrhStationPlaceholder
        title={customTitle || "RRH Post-Burn-in Test"}
        subtitle="Post-thermal endurance testing, power cycling recovery, and functional verification."
        cardTitle="Post-Burn-in Test Station"
        sectionTitle="Post-Burn-in Functional Testing"
        description="This station is ready for development. Connect post-bake functional validation, RF transceiver performance metrics, and burn-in release logs here."
        headerIcon={Thermometer}
        cardIcon={CheckCircle2}
        emptyIcon={Thermometer}
        routeType={routeType}
    />
);
