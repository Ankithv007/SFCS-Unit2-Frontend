import React from 'react';
import { ArrowDownRight, PackageCheck } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

export const RrhInward: React.FC = () => (
    <RrhStationPlaceholder
        title="RRH Inward Material"
        subtitle="Manage and record incoming RRH assemblies, components, and raw materials."
        cardTitle="Inward Station Processing"
        sectionTitle="Inward Material Workflow"
        description="This station is ready for development. Connect incoming batch scanning, parts verification, and supplier lot linkage here."
        headerIcon={ArrowDownRight}
        cardIcon={PackageCheck}
        emptyIcon={PackageCheck}
    />
);
