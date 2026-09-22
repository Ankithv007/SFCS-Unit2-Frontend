import React from 'react';
import { Eye, CheckCircle2 } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

export const RrhIvi: React.FC = () => (
    <RrhStationPlaceholder
        title="RRH IVI (Initial Visual Inspection)"
        subtitle="Perform and record initial visual inspections for RRH mechanical parts and assemblies."
        cardTitle="Visual Inspection Checklist"
        sectionTitle="IVI Inspection Station"
        description="This station is ready for development. Connect visual defect logging, criteria pass/fail checklists, and serial tagging here."
        headerIcon={Eye}
        cardIcon={CheckCircle2}
        emptyIcon={Eye}
    />
);
