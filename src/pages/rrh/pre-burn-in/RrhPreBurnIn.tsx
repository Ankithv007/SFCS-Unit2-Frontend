import React from 'react';
import { Flame, Activity } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

interface RrhPreBurnInProps {
    routeType?: 'ECN' | 'Non-ECN';
}

export const RrhPreBurnIn: React.FC<RrhPreBurnInProps> = ({ routeType }) => (
    <RrhStationPlaceholder
        title="RRH Pre-Burn-in Test"
        subtitle="Pre-thermal stress electrical screening and initial functional parameters verification."
        cardTitle="Pre-Burn-in Testing"
        sectionTitle="Pre-Burn-in Test Station"
        description="This station is ready for development. Connect initial RF/functional parameter testing, voltage checks, and pre-burn screening records here."
        headerIcon={Flame}
        cardIcon={Activity}
        emptyIcon={Flame}
        routeType={routeType}
    />
);
