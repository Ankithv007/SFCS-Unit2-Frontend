import React from 'react';
import { Bug, Wrench } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

export const RrhDebug: React.FC = () => (
    <RrhStationPlaceholder
        title="RRH Debug Station"
        subtitle="Diagnose, isolate root causes, and log rework actions for rejected RRH units."
        cardTitle="Unit Failure Analysis"
        sectionTitle="Debug & Rework Station"
        description="This station is ready for development. Connect unit failure logging, component fault tree analysis, and rework history tracking here."
        headerIcon={Bug}
        cardIcon={Wrench}
        emptyIcon={Bug}
    />
);
