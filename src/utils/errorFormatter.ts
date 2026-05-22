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
        actualStage
    } = error;

    switch (errorCode) {
        case 'WRONG_BATCH':
            return `This barcode belongs to a different Work Order / Batch.
${batch || workOrder ? `(Assigned: Batch ${batch || '-'} / WO ${workOrder || '-'})` : ''}

Please scan it in the correct production batch.`;

        case 'INVALID_STAGE':
        case 'INVALID_TRANSITION':
            return `This unit cannot be scanned in ${currentStage || 'this stage'} yet.

Required previous stage:
${requiredStage || 'the correct preceding stage'}

Please complete ${requiredStage || 'preceding'} process first before continuing.`;

        case 'ALREADY_COMPLETED':
            return `This barcode has already completed this stage.
Duplicate scanning is not allowed.`;

        case 'UNDER_REWORK':
            return `This unit is currently under Rework process.

Complete repair and revalidation before continuing production flow.`;

        case 'UNDER_DEBUG':
            return `This unit is currently under Debug process.

Complete repair and revalidation before continuing production flow.`;

        case 'WRONG_QUEUE':
            return `This barcode belongs to the ${actualStage || 'correct'} repair queue.

Please repair it in the correct source-stage queue.`;

        case 'USN_REQUIRED':
            return `Barcode has not been linked to a Unit Serial Number (USN).

Please scan and complete the PCBA-FCT process with USN linking first.`;

        case 'DUPLICATE_USN':
            return `This Unit Serial Number is already linked to another barcode.

Duplicate scanning or reuse is not allowed.`;

        default:
            return message || 'An unknown validation error occurred.';
    }
};
