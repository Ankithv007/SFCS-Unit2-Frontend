import React from 'react';
import { Cpu, FileCode } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

interface RrhProgrammingProps {
    routeType?: 'ECN' | 'Non-ECN';
}

export const RrhProgramming: React.FC<RrhProgrammingProps> = ({ routeType }) => (
    <RrhStationPlaceholder
        title="RRH Programming"
        subtitle="Firmware flashing, initial configuration, and device programming verification."
        cardTitle="Device Programming Station"
        sectionTitle="Programming & Flashing Station"
        description="This station is ready for development. Connect firmware flashing, checksum verification, board configuration, and programming status logging here."
        headerIcon={Cpu}
        cardIcon={FileCode}
        emptyIcon={Cpu}
        routeType={routeType}
    />
);
