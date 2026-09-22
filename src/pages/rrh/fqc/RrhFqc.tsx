import React from 'react';
import { Award, CheckSquare2 } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

export const RrhFqc: React.FC = () => (
    <RrhStationPlaceholder
        title="RRH FQC (Final Quality Control)"
        subtitle="Final quality assurance inspection, enclosure sealing verification, and finished goods release."
        cardTitle="Final Quality Inspection"
        sectionTitle="FQC Inspection Station"
        description="This station is ready for development. Connect final unit inspection, cosmetic checks, label grading, and QA release approval here."
        headerIcon={Award}
        cardIcon={CheckSquare2}
        emptyIcon={Award}
    />
);
