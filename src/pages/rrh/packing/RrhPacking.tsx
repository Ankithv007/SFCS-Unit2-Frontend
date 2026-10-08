import React from 'react';
import { Package, PackageCheck } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

interface RrhPackingProps {
    routeType?: 'ECN' | 'Non-ECN';
}

export const RrhPacking: React.FC<RrhPackingProps> = ({ routeType }) => (
    <RrhStationPlaceholder
        title="RRH Packing"
        subtitle="Final unit carton boxing, accessory packing, and barcode serial labeling."
        cardTitle="Unit Packing Station"
        sectionTitle="Packing Operations"
        description="This station is ready for development. Connect box scanning, accessory kit verification, outer label printing, and carton aggregation here."
        headerIcon={Package}
        cardIcon={PackageCheck}
        emptyIcon={Package}
        routeType={routeType}
    />
);
