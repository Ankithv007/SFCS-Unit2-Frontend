export const formatScanError = (error: any): string => {
    // If it's not a structured error, just return the default message
    if (!error || !error.errorCode) {
        return error?.message || 'Scan failed';
    }

    const {
        errorCode,
        message,
        currentStage,
        requiredStage,
        workOrder,
        batch,
        actualBatch,
        actualStage,
        suggestedAction
    } = error;

    switch (errorCode) {
        case 'WRONG_BATCH':
            return `This barcode belongs to Batch: ${batch || 'UNKNOWN'}
and cannot be scanned in Batch: ${actualBatch || 'UNKNOWN'}.

Barcode belongs to Work Order: ${workOrder || 'UNKNOWN'}
Current Stage: ${currentStage || 'UNKNOWN'}`;

        case 'INVALID_STAGE':
            return `Previous required stage is missing.

Barcode must complete:
${requiredStage || 'UNKNOWN'} stage

before scanning in:
${currentStage || 'UNKNOWN'}.`;

        case 'ALREADY_COMPLETED':
            return `Barcode already completed this stage.`;

        case 'UNDER_REWORK':
            return `Barcode currently under Rework process.

Complete Rework and ${suggestedAction ? suggestedAction : 'QA validation before proceeding.'}`;

        case 'UNDER_DEBUG':
            return `Barcode currently under Debug process.

${suggestedAction ? suggestedAction : ''}`;

        case 'INVALID_TRANSITION':
            return `Previous required stage is missing.
            
Barcode must complete:
${requiredStage || 'UNKNOWN'} stage

before scanning in:
${currentStage || 'UNKNOWN'}.

Current Status: ${actualStage || 'UNKNOWN'}`;

        default:
            return message || 'An unknown validation error occurred.';
    }
};
