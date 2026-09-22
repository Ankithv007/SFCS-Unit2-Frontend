import React from 'react';
import { Play, Activity } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

export const RrhTesting: React.FC = () => (
    <RrhStationPlaceholder
        title="RRH Functional & RF Testing"
        subtitle="Execute automated test sequences, capture telemetry, and validate RF calibration parameters."
        cardTitle="Test Bench Execution"
        sectionTitle="Testing Station"
        description="This station is ready for development. Connect automated test jig integration, pass/fail result ingestion, and RF spectrum validation here."
        headerIcon={Play}
        cardIcon={Activity}
        emptyIcon={Activity}
    />
);
