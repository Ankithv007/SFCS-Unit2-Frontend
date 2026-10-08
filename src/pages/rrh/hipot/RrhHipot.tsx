import React from 'react';
import { Zap, ShieldAlert } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

interface RrhHipotProps {
    routeType?: 'ECN' | 'Non-ECN';
}

export const RrhHipot: React.FC<RrhHipotProps> = ({ routeType }) => (
    <RrhStationPlaceholder
        title="RRH Hipot Test"
        subtitle="High potential dielectric withstand test, insulation resistance, and grounding continuity."
        cardTitle="Hipot Dielectric Testing"
        sectionTitle="Hipot Safety Testing Station"
        description="This station is ready for development. Connect AC/DC dielectric withstand tests, leakage current thresholds, and electrical safety validation here."
        headerIcon={Zap}
        cardIcon={ShieldAlert}
        emptyIcon={Zap}
        routeType={routeType}
    />
);
