import React from 'react';
import { PackageSearch, Search } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

interface RrhObaProps {
    routeType?: 'ECN' | 'Non-ECN';
}

export const RrhOba: React.FC<RrhObaProps> = ({ routeType }) => (
    <RrhStationPlaceholder
        title="RRH OBA (Out of Box Audit)"
        subtitle="Sample inspection and out-of-box auditing prior to warehouse transfer and shipping."
        cardTitle="Out of Box Audit Inspection"
        sectionTitle="OBA Audit Station"
        description="This station is ready for development. Connect AQL sampling, unboxing audit parameters, and lot acceptance records here."
        headerIcon={PackageSearch}
        cardIcon={Search}
        emptyIcon={PackageSearch}
        routeType={routeType}
    />
);
