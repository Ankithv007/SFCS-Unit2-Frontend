import React from 'react';
import { Truck, Send } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

interface RrhShipmentProps {
    routeType?: 'ECN' | 'Non-ECN';
}

export const RrhShipment: React.FC<RrhShipmentProps> = ({ routeType }) => (
    <RrhStationPlaceholder
        title="RRH Shipment"
        subtitle="Palletization, dispatch inspection, and outgoing shipping data manifest generation."
        cardTitle="Outgoing Shipping & Manifest"
        sectionTitle="Shipment Dispatch Station"
        description="This station is ready for development. Connect pallet barcode association, dispatch manifest generation, ERP shipment sync, and logistics handoff here."
        headerIcon={Truck}
        cardIcon={Send}
        emptyIcon={Truck}
        routeType={routeType}
    />
);
