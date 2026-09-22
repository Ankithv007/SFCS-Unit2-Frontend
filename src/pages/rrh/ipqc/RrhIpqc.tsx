import React from 'react';
import { ShieldCheck, ClipboardCheck } from 'lucide-react';
import { RrhStationPlaceholder } from '../components/RrhStationPlaceholder';

export const RrhIpqc: React.FC = () => (
    <RrhStationPlaceholder
        title="RRH IPQC (In-Process Quality Control)"
        subtitle="Monitor and audit inline assembly parameters, line clearance, and process quality gates."
        cardTitle="In-Process Quality Audits"
        sectionTitle="IPQC Station"
        description="This station is ready for development. Connect stage-by-stage quality parameter monitoring, torque verification, and audit sign-offs here."
        headerIcon={ShieldCheck}
        cardIcon={ClipboardCheck}
        emptyIcon={ShieldCheck}
    />
);
