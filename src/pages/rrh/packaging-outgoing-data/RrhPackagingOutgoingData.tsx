import React from 'react';
import { Package, Truck } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

export const RrhPackagingOutgoingData: React.FC = () => (
    <RrhStationPlaceholder
        title="RRH Packaging & Outgoing Data"
        subtitle="Final packaging, box barcode labeling, palletization, and outgoing shipment data manifest."
        cardTitle="Packaging & Outgoing Manifest"
        sectionTitle="Packaging & Outgoing Data Station"
        description="This station is ready for development. Connect carton box packing, serial scanning, dispatch pallet generation, and outgoing data reporting here."
        headerIcon={Package}
        cardIcon={Truck}
        emptyIcon={Package}
    />
);
