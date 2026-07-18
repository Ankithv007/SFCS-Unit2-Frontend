import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './SerialNumber.module.css';
import { WorkOrderSelector } from '../../components/WorkOrderSelector';
import { useSmtAuth } from '../../context/SmtAuthContext';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../utils/api';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

// --- Toast Interface ---
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }

const Toaster: React.FC<{ toasts: Toast[]; onRemove: (id: number) => void }> = ({ toasts, onRemove }) => (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', flexDirection: 'column-reverse', gap: '0.5rem' }}>
        {toasts.map(t => (
            <div key={t.id} onClick={() => onRemove(t.id)} style={{
                padding: '0.85rem 1.25rem', borderRadius: '0.6rem', cursor: 'pointer', minWidth: '280px',
                background: t.type === 'error' ? '#fee2e2' : t.type === 'success' ? '#dcfce7' : '#eff6ff',
                color: t.type === 'error' ? '#991b1b' : t.type === 'success' ? '#166534' : '#1e40af',
                border: `1px solid ${t.type === 'error' ? '#fca5a5' : t.type === 'success' ? '#86efac' : '#bfdbfe'}`,
                fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                animation: 'slideIn 0.2s ease'
            }}>
                {t.type === 'error' ? '❌ ' : t.type === 'success' ? '✅ ' : 'ℹ️ '}{t.message}
            </div>
        ))}
    </div>
);

// --- TS Typings ---
interface SerialGenerationRecord {
    id: string;
    work_order_id: string;
    po_id: string;
    work_order_number: string;
    product_name: string;
    product_description: string;
    work_order_quantity: number;
    panel_quantity: number;
    sides: string;
    line_id: string;
    work_order_remarks: string;
    barcode_source: 'GENERATE' | 'CUSTOMER' | 'LASER';
    generated_quantity: number;
    serial_generation_remarks: string;
    additional_notes: string;
    created_by: string;
    created_by_name: string;
    created_at: string;
    updated_by?: string;
    updated_by_name?: string;
    updated_at?: string;
}

export const SerialNumber: React.FC = () => {
    const { smtUser, smtLogout } = useSmtAuth();
    const { user } = useAuth();

    // Check operator authority
    const userRole = user?.role || smtUser?.role || 'Operator';
    const isSuperAdmin = userRole === 'Super Admin';

    // Toast state
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastId = useRef(0);
    const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);
    const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    // Work Orders list
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [selectedWoId, setSelectedWoId] = useState('');
    const [selectedWo, setSelectedWo] = useState<any | null>(null);

    // Form inputs state
    const [barcodeSource, setBarcodeSource] = useState<'GENERATE' | 'CUSTOMER' | 'LASER'>('GENERATE');
    const [remarks, setRemarks] = useState('');
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // GENERATE specific state
    const [prefix, setPrefix] = useState('');
    const [suffix, setSuffix] = useState('');
    const [separator, setSeparator] = useState('None');
    const [startingNumber, setStartingNumber] = useState('');
    const [endingNumber, setEndingNumber] = useState('');
    const [numberLength, setNumberLength] = useState('');
    const [previewSerials, setPreviewSerials] = useState<string[]>([]);

    // CUSTOMER scan specific state
    const [scanInput, setScanInput] = useState('');
    const [scannedBarcodes, setScannedBarcodes] = useState<string[]>([]);
    const [duplicateScanCount, setDuplicateScanCount] = useState(0);
    const [duplicateScanLog, setDuplicateScanLog] = useState<any[]>([]);
    const [existingBatch, setExistingBatch] = useState<SerialGenerationRecord | null>(null);
    const [savedBarcodes, setSavedBarcodes] = useState<string[]>([]);

    // LASER file specific state
    const [laserFile, setLaserFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [laserValidationData, setLaserValidationData] = useState<{
        temp_file_path: string;
        original_filename: string;
        serials: string[];
    } | null>(null);
    const [isValidatingLaserFile, setIsValidatingLaserFile] = useState(false);
    const [showLaserMismatchModal, setShowLaserMismatchModal] = useState(false);
    const [laserMismatchDetails, setLaserMismatchDetails] = useState<{
        remainingQty: number;
        fileCount: number;
    } | null>(null);

    // Continue Scanning Modal State
    const [continueScanRecord, setContinueScanRecord] = useState<SerialGenerationRecord | null>(null);
    const [continueScannedSerials, setContinueScannedSerials] = useState<string[]>([]);
    const [continueScannedCount, setContinueScannedCount] = useState(0);
    const [continueScanInput, setContinueScanInput] = useState('');
    const [isSubmittingContinueScan, setIsSubmittingContinueScan] = useState(false);

    // Records log state
    const [records, setRecords] = useState<SerialGenerationRecord[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRows, setTotalRows] = useState(0);

    // View Details modal state
    const [viewRecord, setViewRecord] = useState<SerialGenerationRecord | null>(null);
    const [recordMetadata, setRecordMetadata] = useState<any>(null);
    const [recordSerials, setRecordSerials] = useState<any[]>([]);
    const [serialsPage, setSerialsPage] = useState(1);
    const [serialsTotalPages, setSerialsTotalPages] = useState(1);
    const [serialsSearch, setSerialsSearch] = useState('');
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [qrCodeMap, setQrCodeMap] = useState<{[key: string]: string}>({});
    const [isZipping, setIsZipping] = useState(false);
    const [pdfProgress, setPdfProgress] = useState<string | null>(null);
    const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
    const [panelFileName, setPanelFileName] = useState('');
    const [modalPanelFileName, setModalPanelFileName] = useState('');

    // Large QR Preview modal state
    const [previewQrSerial, setPreviewQrSerial] = useState<string | null>(null);

    // Edit customer barcode modal state
    const [editingSerial, setEditingSerial] = useState<any>(null);
    const [editBarcodeValue, setEditBarcodeValue] = useState<string>('');
    const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

    const fetchWorkOrders = async () => {
        try {
            const data = await apiFetch('/api/smt/workorders/pending');
            setWorkOrders(data);
        } catch (err) {
            console.error('Error fetching pending work orders:', err);
        }
    };

    const fetchRecords = async () => {
        try {
            const queryParams = new URLSearchParams({
                page: currentPage.toString(),
                limit: '8',
                search: searchQuery
            });
            const data = await apiFetch(`/api/smt/v1/smt/serial-generation-records?${queryParams.toString()}`);
            if (data?.success) {
                setRecords(data.records);
                setTotalPages(data.pagination.totalPages);
                setTotalRows(data.pagination.totalRows);
            }
        } catch (err) {
            console.error('Error fetching records:', err);
        }
    };

    useEffect(() => {
        fetchWorkOrders();
    }, []);

    useEffect(() => {
        fetchRecords();
    }, [currentPage, searchQuery]);

    const fetchActiveCustomerBatch = useCallback(async (woId: string) => {
        try {
            const data = await apiFetch(`/api/smt/v1/smt/serial-generation-records/active-customer/${woId}`);
            if (data?.success && data?.hasExisting) {
                setExistingBatch(data.batch);
                setSavedBarcodes(data.serials);
                setRemarks(data.batch.serial_generation_remarks || '');
                setAdditionalNotes(data.batch.additional_notes || '');
            } else {
                setExistingBatch(null);
                setSavedBarcodes([]);
                setRemarks('');
                setAdditionalNotes('');
            }
        } catch (err) {
            console.error('Error fetching active customer batch:', err);
            setExistingBatch(null);
            setSavedBarcodes([]);
            setRemarks('');
            setAdditionalNotes('');
        }
    }, []);

    useEffect(() => {
        if (selectedWoId && barcodeSource === 'CUSTOMER') {
            fetchActiveCustomerBatch(selectedWoId);
        } else {
            setExistingBatch(null);
            setSavedBarcodes([]);
        }
    }, [selectedWoId, barcodeSource, fetchActiveCustomerBatch]);

    useEffect(() => {
        if (selectedWoId) {
            const wo = workOrders.find(w => w.id === selectedWoId);
            if (wo) {
                setSelectedWo(wo);
                const stored = localStorage.getItem(`panel_file_name_wo_${selectedWoId}`) || '';
                setPanelFileName(stored);
            } else {
                setSelectedWo(null);
                setSelectedWoId('');
                setExistingBatch(null);
                setSavedBarcodes([]);
                setRemarks('');
                setAdditionalNotes('');
                setPanelFileName('');
            }
        } else {
            setSelectedWo(null);
            setPanelFileName('');
        }
    }, [selectedWoId, workOrders]);

    // Live preview generator for GENERATE source
    const getSeparatorChar = (sep: string) => {
        if (sep === 'Hyphen (-)') return '-';
        if (sep === 'Underscore (_)') return '_';
        if (sep === 'Slash (/)') return '/';
        if (sep === 'Space') return ' ';
        return '';
    };

    const generatePreview = useCallback(() => {
        const start = parseInt(startingNumber, 10);
        const end = parseInt(endingNumber, 10);
        if (isNaN(start) || isNaN(end) || start > end) {
            setPreviewSerials([]);
            return;
        }

        const count = end - start + 1;
        const displayLimit = Math.min(count, 15);
        const separatorSymbol = getSeparatorChar(separator);
        const padLength = numberLength && parseInt(numberLength, 10) > 0 
            ? parseInt(numberLength, 10) 
            : startingNumber.length;

        const previews: string[] = [];
        for (let i = 0; i < displayLimit; i++) {
            const currentNumVal = start + i;
            const numStr = currentNumVal.toString().padStart(padLength, '0');
            const parts: string[] = [];
            if (prefix.trim()) parts.push(prefix.trim());
            parts.push(numStr);
            if (suffix.trim()) parts.push(suffix.trim());
            previews.push(parts.join(separatorSymbol));
        }

        setPreviewSerials(previews);
    }, [prefix, suffix, separator, startingNumber, endingNumber, numberLength]);

    useEffect(() => {
        if (barcodeSource === 'GENERATE') {
            generatePreview();
        }
    }, [barcodeSource, prefix, suffix, separator, startingNumber, endingNumber, numberLength, generatePreview]);

    // --- Customer scanning handler ---
    const handleScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = scanInput.trim();
        if (!code) return;

        const totalScanned = savedBarcodes.length + scannedBarcodes.length;
        if (selectedWo && totalScanned >= selectedWo.quantity) {
            addToast('Cannot scan more barcodes. Work Order quantity limit reached.', 'error');
            setScanInput('');
            return;
        }

        if (scannedBarcodes.includes(code) || savedBarcodes.includes(code)) {
            setDuplicateScanCount(prev => prev + 1);
            setDuplicateScanLog(prev => [
                { barcode: code, scannedAt: new Date().toLocaleTimeString() },
                ...prev
            ]);
            addToast('This barcode has already been scanned. Duplicate barcode is not allowed.', 'error');
            setScanInput('');
            return;
        }

        try {
            const checkRes = await apiFetch(`/api/smt/v1/smt/serial-generation-records/check-serial/${encodeURIComponent(code)}`);
            if (checkRes?.exists) {
                setDuplicateScanCount(prev => prev + 1);
                setDuplicateScanLog(prev => [
                    { barcode: code, scannedAt: new Date().toLocaleTimeString() },
                    ...prev
                ]);
                addToast('This barcode has already been scanned. Duplicate barcode is not allowed.', 'error');
                setScanInput('');
                return;
            }

            setScannedBarcodes(prev => [code, ...prev]);
            addToast(`Scanned barcode: ${code}`, 'success');
        } catch (err: any) {
            addToast(`Validation failed: ${err.message}`, 'error');
        }
        setScanInput('');
    };

    const handleRemoveScan = (indexToRemove: number) => {
        setScannedBarcodes(prev => prev.filter((_, idx) => idx !== indexToRemove));
        addToast('Scanned barcode removed.', 'info');
    };

    // --- Continue Scanning Modal Handlers ---
    const handleStartContinueScanning = async (record: SerialGenerationRecord) => {
        setContinueScanRecord(record);
        setContinueScannedCount(record.generated_quantity);
        setContinueScanInput('');
        
        try {
            const queryParams = new URLSearchParams({
                page: '1',
                limit: '50',
                search: ''
            });
            const data = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${record.id}/serials?${queryParams.toString()}`);
            if (data?.success) {
                setContinueScannedSerials(data.serials.map((s: any) => s.serial_number));
            } else {
                setContinueScannedSerials([]);
            }
        } catch (err) {
            console.error('Error loading resume serials list:', err);
            setContinueScannedSerials([]);
        }
    };

    const handleContinueScanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!continueScanRecord) return;

        const code = continueScanInput.trim();
        if (!code) return;

        if (continueScannedSerials.includes(code)) {
            addToast('This barcode has already been scanned. Duplicate barcode is not allowed.', 'error');
            setContinueScanInput('');
            return;
        }

        try {
            setIsSubmittingContinueScan(true);
            
            const checkRes = await apiFetch(`/api/smt/v1/smt/serial-generation-records/check-serial/${encodeURIComponent(code)}`);
            if (checkRes?.exists) {
                addToast('This barcode has already been scanned. Duplicate barcode is not allowed.', 'error');
                setContinueScanInput('');
                return;
            }

            const res = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${continueScanRecord.id}/scans`, {
                method: 'POST',
                body: JSON.stringify({ barcode: code })
            });

            if (res?.success) {
                addToast(`Barcode "${code}" saved successfully.`, 'success');
                setContinueScannedSerials(prev => [code, ...prev]);
                setContinueScannedCount(res.scannedCount);
                setRecords(prev => prev.map(rec => rec.id === continueScanRecord.id ? { ...rec, generated_quantity: res.scannedCount } : rec));
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to add scanned barcode.', 'error');
        } finally {
            setIsSubmittingContinueScan(false);
            setContinueScanInput('');
        }
    };

    const handleCloseContinueScan = () => {
        setContinueScanRecord(null);
        fetchWorkOrders();
        fetchRecords();
    };

    // --- Drag and Drop File Handlers ---
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleLaserFileSelected(file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleLaserFileSelected(file);
        }
    };

    const handleLaserFileSelected = async (file: File) => {
        if (!selectedWoId) {
            addToast('Please select a Work Order first.', 'error');
            return;
        }

        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const allowedExts = ['.pdf', '.xls', '.xlsx', '.csv', '.zip', '.txt'];
        if (!allowedExts.includes(ext)) {
            addToast(`Extension ${ext} not allowed. Please upload PDF, Excel, CSV, TXT or ZIP.`, 'error');
            return;
        }

        const maxBytes = 50 * 1024 * 1024;
        if (file.size > maxBytes) {
            addToast('File size exceeds maximum 50MB limit.', 'error');
            return;
        }

        setLaserFile(file);
        setIsValidatingLaserFile(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await apiFetch('/api/smt/v1/smt/serial-generation-records/laser/validate', {
                method: 'POST',
                body: formData
            });

            if (res?.success) {
                const valData = {
                    temp_file_path: res.temp_file_path,
                    original_filename: res.original_filename,
                    serials: res.serials
                };
                setLaserValidationData(valData);
                addToast(`File parsed successfully. Extracted ${res.serialCount} serial numbers.`, 'success');

                const woRemainingQty = selectedWo 
                    ? Math.max(0, selectedWo.quantity - Number(selectedWo.generated_count || 0))
                    : 0;

                if (res.serialCount !== woRemainingQty) {
                    setLaserMismatchDetails({
                        remainingQty: woRemainingQty,
                        fileCount: res.serialCount
                    });
                    setShowLaserMismatchModal(true);
                } else {
                    await saveLaserRecord(valData);
                }
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to validate laser file.', 'error');
            setLaserFile(null);
            setLaserValidationData(null);
        } finally {
            setIsValidatingLaserFile(false);
        }
    };

    const handleCancelLaserMismatch = async () => {
        setShowLaserMismatchModal(false);
        if (laserValidationData?.temp_file_path) {
            try {
                await apiFetch('/api/smt/v1/smt/serial-generation-records/laser/cleanup-temp', {
                    method: 'POST',
                    body: JSON.stringify({ temp_file_path: laserValidationData.temp_file_path })
                });
            } catch (e) {}
        }
        setLaserFile(null);
        setLaserValidationData(null);
        setLaserMismatchDetails(null);
        addToast('Laser machine file upload cancelled.', 'info');
    };

    const handleContinueLaserMismatch = async () => {
        setShowLaserMismatchModal(false);
        if (laserValidationData) {
            await saveLaserRecord(laserValidationData);
        }
    };

    const saveLaserRecord = async (valData: { temp_file_path: string; original_filename: string; serials: string[] }) => {
        setIsSubmitting(true);
        try {
            const payload = {
                work_order_id: selectedWoId,
                barcode_source: 'LASER',
                remarks,
                additional_notes: additionalNotes,
                temp_file_path: valData.temp_file_path,
                original_filename: valData.original_filename,
                serials: valData.serials
            };

            const res = await apiFetch('/api/smt/v1/smt/serial-generation-records', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res?.success) {
                addToast('Laser machine serial generation record saved successfully.', 'success');
                resetForm();
                setCurrentPage(1);
                fetchWorkOrders();
                fetchRecords();
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to save laser machine record.', 'error');
            try {
                await apiFetch('/api/smt/v1/smt/serial-generation-records/laser/cleanup-temp', {
                    method: 'POST',
                    body: JSON.stringify({ temp_file_path: valData.temp_file_path })
                });
            } catch (e) {}
            setLaserFile(null);
            setLaserValidationData(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveFile = async () => {
        if (laserValidationData?.temp_file_path) {
            try {
                await apiFetch('/api/smt/v1/smt/serial-generation-records/laser/cleanup-temp', {
                    method: 'POST',
                    body: JSON.stringify({ temp_file_path: laserValidationData.temp_file_path })
                });
            } catch (e) {}
        }
        setLaserFile(null);
        setLaserValidationData(null);
        addToast('Attached file removed.', 'info');
    };

    // --- Submit workflow ---
    const handleCreateRecordSubmit = async () => {
        if (!selectedWoId) {
            addToast('Please select a Work Order first.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            if (barcodeSource === 'GENERATE') {
                if (!startingNumber || !endingNumber || !separator) {
                    throw new Error('Please fill in starting/ending numbers and separator settings.');
                }
                const startVal = parseInt(startingNumber, 10);
                const endVal = parseInt(endingNumber, 10);
                if (isNaN(startVal) || isNaN(endVal) || startVal > endVal) {
                    throw new Error('Invalid starting/ending numeric range.');
                }

                const payload = {
                    work_order_id: selectedWoId,
                    barcode_source: 'GENERATE',
                    remarks,
                    additional_notes: additionalNotes,
                    prefix,
                    suffix,
                    separator,
                    starting_number: startingNumber,
                    ending_number: endingNumber,
                    number_length: numberLength
                };

                const res = await apiFetch('/api/smt/v1/smt/serial-generation-records', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (res?.success) {
                    addToast(`Serials registered successfully for Work Order. Generated quantity: ${res.record.generated_quantity}`, 'success');
                    if (panelFileName.trim()) {
                        localStorage.setItem(`panel_file_name_${res.record.id}`, panelFileName.trim());
                    }
                    resetForm();
                    setCurrentPage(1);
                    fetchWorkOrders();
                    fetchRecords();
                }

            } else if (barcodeSource === 'CUSTOMER') {
                if (scannedBarcodes.length === 0) {
                    throw new Error('Please scan at least one customer barcode.');
                }

                const payload = {
                    work_order_id: selectedWoId,
                    barcode_source: 'CUSTOMER',
                    remarks,
                    additional_notes: additionalNotes,
                    scanned_barcodes: scannedBarcodes,
                    duplicate_scan_count: duplicateScanCount,
                    duplicate_scan_log: duplicateScanLog
                };

                const res = await apiFetch('/api/smt/v1/smt/serial-generation-records', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (res?.success) {
                    addToast(`Customer barcodes registered successfully. Quantity: ${res.record.generated_quantity}`, 'success');
                    setScanInput('');
                    setScannedBarcodes([]);
                    setDuplicateScanCount(0);
                    setDuplicateScanLog([]);
                    setCurrentPage(1);
                    fetchWorkOrders();
                    fetchRecords();
                    if (res.record.status !== 'Completed') {
                        fetchActiveCustomerBatch(selectedWoId);
                    }
                }

            } else if (barcodeSource === 'LASER') {
                if (!laserFile || !laserValidationData) {
                    throw new Error('Please upload a Laser Machine mapping file first.');
                }
                await saveLaserRecord(laserValidationData);
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to generate serials.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setSelectedWoId('');
        setRemarks('');
        setAdditionalNotes('');
        setPrefix('');
        setSuffix('');
        setSeparator('None');
        setStartingNumber('');
        setEndingNumber('');
        setNumberLength('');
        setPreviewSerials([]);
        setScanInput('');
        setScannedBarcodes([]);
        setDuplicateScanCount(0);
        setDuplicateScanLog([]);
        setLaserFile(null);
        setLaserValidationData(null);
        setLaserMismatchDetails(null);
        setPanelFileName('');
    };

    // --- Deletion ---
    const handleDeleteRecord = async (recordId: string, workOrderNumber: string) => {
        if (!isSuperAdmin) {
            addToast("Only Super Admin is authorized to delete records.\nPlease contact your Super Admin if this record needs to be deleted.", 'error');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete the Serial Generation Record for Work Order ${workOrderNumber}?`)) {
            return;
        }

        try {
            const res = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${recordId}`, {
                method: 'DELETE'
            });
            if (res?.success) {
                addToast(res.message, 'success');
                if (viewRecord?.id === recordId) setViewRecord(null);
                fetchWorkOrders();
                fetchRecords();
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to delete record.', 'error');
        }
    };

    // --- View Details ---
    const fetchRecordDetails = async (id: string) => {
        setIsLoadingDetails(true);
        try {
            const data = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${id}`);
            if (data?.success) {
                setViewRecord(data.record);
                setRecordMetadata(data.sourceConfig);
                setSerialsPage(1);

                const stored = localStorage.getItem(`panel_file_name_${data.record.id}`) || 
                               localStorage.getItem(`panel_file_name_wo_${data.record.work_order_id}`) || '';
                setModalPanelFileName(stored);

                fetchRecordSerialsList(data.record.id, 1, serialsSearch);
            }
        } catch (err: any) {
            addToast(`Failed to load details: ${err.message}`, 'error');
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const fetchRecordSerialsList = async (recordId: string, page: number, search: string) => {
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '8',
                search: search
            });
            const data = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${recordId}/serials?${queryParams.toString()}`);
            if (data?.success) {
                setRecordSerials(data.serials);
                setSerialsTotalPages(data.pagination.totalPages);
            }
        } catch (err) {
            console.error('Error fetching serials list:', err);
        }
    };

    useEffect(() => {
        if (viewRecord) {
            fetchRecordSerialsList(viewRecord.id, serialsPage, serialsSearch);
        }
    }, [serialsPage, serialsSearch]);

    const handleOpenEditModal = (serial: any) => {
        setEditingSerial(serial);
        setEditBarcodeValue(serial.serial_number);
    };

    const handleSaveEditBarcode = async () => {
        const trimmed = editBarcodeValue.trim();
        if (!trimmed) {
            addToast('Barcode cannot be empty.', 'error');
            return;
        }

        if (editingSerial.serial_number === trimmed) {
            addToast('No changes detected.', 'error');
            return;
        }

        setIsSavingEdit(true);
        try {
            const res = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${editingSerial.id}/customer-barcode`, {
                method: 'PUT',
                body: JSON.stringify({ customerBarcode: trimmed })
            });

            if (res?.success) {
                addToast(res.message || 'Customer barcode updated successfully.', 'success');
                setEditingSerial(null);
                if (viewRecord) {
                    fetchRecordSerialsList(viewRecord.id, serialsPage, serialsSearch);
                    fetchRecords();
                }
            } else {
                addToast(res?.error || 'Failed to update barcode.', 'error');
            }
        } catch (err: any) {
            addToast(err.message || 'Failed to update barcode.', 'error');
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Canvas based helper to generate QR Code + Serial Text composite
    const generateQRWithText = (serialNumber: string): Promise<string> => {
        const cleanSerial = serialNumber.replace(/-/g, "").toUpperCase();
        return new Promise<string>(async (resolve, reject) => {
            try {
                const qrCanvas = document.createElement('canvas');
                await QRCode.toCanvas(qrCanvas, cleanSerial, {
                    width: 250,
                    margin: 2,
                    errorCorrectionLevel: 'M'
                });
                
                const canvas = document.createElement('canvas');
                canvas.width = 250;
                canvas.height = 295;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(qrCanvas, 0, 0);

                ctx.font = 'bold 15px Courier, monospace';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(serialNumber, canvas.width / 2, 272);

                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                reject(err);
            }
        });
    };

    const getCanvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create canvas blob'));
                }
            }, 'image/png');
        });
    };

    const generateQRComposite = async (
        serialNumber: string,
        qrCanvas: HTMLCanvasElement,
        mainCanvas: HTMLCanvasElement
    ) => {
        const cleanSerial = serialNumber.replace(/-/g, "").toUpperCase();
        await QRCode.toCanvas(qrCanvas, cleanSerial, {
            width: 250,
            margin: 2,
            errorCorrectionLevel: 'M'
        });
        
        const ctx = mainCanvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas context not available');
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 250, 295);
        ctx.drawImage(qrCanvas, 0, 0);

        ctx.font = 'bold 15px Courier, monospace';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(serialNumber, 125, 272);
    };

    // Populate composite QR codes
    useEffect(() => {
        const generateQRs = async () => {
            const newMap: {[key: string]: string} = {};
            for (const s of recordSerials) {
                if (qrCodeMap[s.serial_number]) continue;
                try {
                    newMap[s.serial_number] = await generateQRWithText(s.serial_number);
                } catch (err) {
                    console.error('QR code generation error:', err);
                }
            }
            if (Object.keys(newMap).length > 0) {
                setQrCodeMap(prev => ({ ...prev, ...newMap }));
            }
        };
        if (recordSerials.length > 0) {
            generateQRs();
        }
    }, [recordSerials]);

    // Download Single QR Code image as PNG
    const handleDownloadSingleQR = async (serialNumber: string) => {
        try {
            addToast(`Generating QR PNG for ${serialNumber}...`, 'info');
            const dataUrl = await generateQRWithText(serialNumber);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = dataUrl;
            a.download = `${serialNumber}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            addToast(`Downloaded ${serialNumber}.png successfully!`, 'success');
        } catch (err: any) {
            addToast(`Failed to download QR code: ${err.message}`, 'error');
        }
    };

    // Download Single QR Code image as PDF
    const handleDownloadSinglePDF = async (serialNumber: string) => {
        try {
            addToast(`Generating QR PDF for ${serialNumber}...`, 'info');
            const dataUrl = await generateQRWithText(serialNumber);
            
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 95]
            });
            doc.addImage(dataUrl, 'PNG', 5, 5, 70, 82.6);
            doc.save(`${serialNumber}.pdf`);
            addToast(`Downloaded ${serialNumber}.pdf successfully!`, 'success');
        } catch (err: any) {
            addToast(`Failed to generate PDF: ${err.message}`, 'error');
        }
    };

    // Download All QR Codes packaged inside a ZIP archive
    const handleDownloadAllQRCodesPNG = async () => {
        if (!viewRecord) return;
        setIsZipping(true);
        try {
            addToast('Fetching all serial numbers for PNG zip compilation...', 'info');
            const queryParams = new URLSearchParams({
                page: '1',
                limit: '999999',
                search: ''
            });
            const data = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${viewRecord.id}/serials?${queryParams.toString()}`);
            if (!data?.success || !Array.isArray(data.serials)) {
                throw new Error('Failed to retrieve serial numbers.');
            }

            const serials = data.serials;
            if (serials.length === 0) {
                addToast('No serial numbers found for this record.', 'info');
                return;
            }

            addToast(`Generating ${serials.length} composite QR PNGs. Please wait...`, 'info');
            
            const zip = new JSZip();
            const qrCanvas = document.createElement('canvas');
            const mainCanvas = document.createElement('canvas');
            mainCanvas.width = 250;
            mainCanvas.height = 295;

            for (const s of serials) {
                await generateQRComposite(s.serial_number, qrCanvas, mainCanvas);
                const blob = await getCanvasBlob(mainCanvas);
                zip.file(`${s.serial_number}.png`, blob);
            }

            addToast('Packaging QR codes into ZIP...', 'info');
            const content = await zip.generateAsync({ type: 'blob' });
            
            const downloadUrl = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = `${viewRecord.work_order_number}_QR_Images.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            addToast('ZIP downloaded successfully!', 'success');
        } catch (err: any) {
            addToast(`Failed to download ZIP file: ${err.message}`, 'error');
        } finally {
            setIsZipping(false);
        }
    };

    // Download All QR Codes compiled into a single combined multi-page PDF document
    const handleDownloadAllQRCodesPDF = async () => {
        if (!viewRecord) return;
        setIsZipping(true);
        setPdfProgress('Initializing...');
        try {
            addToast('Fetching all serial numbers for combined PDF...', 'info');
            const queryParams = new URLSearchParams({
                page: '1',
                limit: '999999',
                search: ''
            });
            const data = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${viewRecord.id}/serials?${queryParams.toString()}`);
            if (!data?.success || !Array.isArray(data.serials)) {
                throw new Error('Failed to retrieve serial numbers.');
            }

            const serials = data.serials;
            if (serials.length === 0) {
                addToast('No serial numbers found for this record.', 'info');
                return;
            }

            addToast(`Generating combined PDF with ${serials.length} pages. Please wait...`, 'info');
            
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 95]
            });

            const qrCanvas = document.createElement('canvas');
            const mainCanvas = document.createElement('canvas');
            mainCanvas.width = 250;
            mainCanvas.height = 295;

            for (let i = 0; i < serials.length; i++) {
                if (i > 0) {
                     doc.addPage([80, 95], 'portrait');
                }
                await generateQRComposite(serials[i].serial_number, qrCanvas, mainCanvas);
                
                // Convert to compressed JPEG data URL to fix memory string length limit crash
                const jpegDataUrl = mainCanvas.toDataURL('image/jpeg', 0.75);
                doc.addImage(jpegDataUrl, 'JPEG', 5, 5, 70, 82.6, undefined, 'FAST');

                // Yield control to event loop every 50 pages to prevent blocking the thread
                if ((i + 1) % 50 === 0 || i === serials.length - 1) {
                    setPdfProgress(`Generating page ${i + 1} of ${serials.length}...`);
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            setPdfProgress('Saving PDF file...');
            await new Promise(r => setTimeout(r, 0));
            doc.save(`${viewRecord.work_order_number}_Serial_Generation.pdf`);
            addToast('All QR codes combined PDF downloaded successfully!', 'success');
        } catch (err: any) {
            addToast(`Failed to generate combined PDF: ${err.message}`, 'error');
        } finally {
            setIsZipping(false);
            setPdfProgress(null);
        }
    };

    const handleDownloadAllTXT = async () => {
        if (!viewRecord) return;
        
        const rawName = localStorage.getItem(`panel_file_name_${viewRecord.id}`) || '';
        const baseFileName = rawName.trim();
        if (!baseFileName) {
            addToast('Please enter a Panel/File Name first.', 'error');
            return;
        }

        setIsZipping(true);
        try {
            addToast('Fetching all serial numbers for TXT compilation...', 'info');
            const queryParams = new URLSearchParams({
                page: '1',
                limit: '999999',
                search: ''
            });
            const data = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${viewRecord.id}/serials?${queryParams.toString()}`);
            if (!data?.success || !Array.isArray(data.serials)) {
                throw new Error('Failed to retrieve serial numbers.');
            }

            const serials = data.serials;
            if (serials.length === 0) {
                addToast('No serial numbers found for this record.', 'info');
                return;
            }

            const workOrderQty = viewRecord.work_order_quantity || 1;
            const panelQty = viewRecord.panel_quantity || 1;
            const pcbPerPanel = Math.max(1, panelQty > 0 ? Math.round(workOrderQty / panelQty) : 1);

            const totalSerials = serials.length;
            const totalPanels = Math.ceil(totalSerials / pcbPerPanel);

            const zip = new JSZip();

            // Function to increment file name based on trailing digits
            const incrementFileName = (base: string, index: number): string => {
                if (index === 0) return base;
                const match = base.match(/^(.*?)(\d+)$/);
                if (!match) {
                    return `${base}_${index + 1}`;
                }
                const textPart = match[1];
                const numPartStr = match[2];
                try {
                    const numVal = BigInt(numPartStr);
                    const newNumVal = numVal + BigInt(index);
                    const paddedNum = newNumVal.toString().padStart(numPartStr.length, '0');
                    return `${textPart}${paddedNum}`;
                } catch (e) {
                    const numVal = parseInt(numPartStr, 10);
                    const newNumVal = numVal + index;
                    const paddedNum = String(newNumVal).padStart(numPartStr.length, '0');
                    return `${textPart}${paddedNum}`;
                }
            };

            // Loop to generate one TXT content per panel
            for (let p = 0; p < totalPanels; p++) {
                const currentFileName = incrementFileName(baseFileName, p);
                
                let fileContent = '';
                
                // Header with trailing comma
                let header = `"PanelID",`;
                for (let i = 1; i <= pcbPerPanel; i++) {
                    header += `"Top_BoardSN${i}",`;
                }
                fileContent += header + '\r\n';

                // Data row with trailing comma
                let row = `"${currentFileName}",`;
                for (let col = 0; col < pcbPerPanel; col++) {
                    const idx = p * pcbPerPanel + col;
                    const sn = idx < totalSerials ? serials[idx].serial_number : '';
                    row += `"${sn}",`;
                }
                fileContent += row + '\r\n';

                // Add to ZIP
                zip.file(`${currentFileName}.txt`, fileContent);
            }

            addToast('Packaging TXT files into ZIP...', 'info');
            const content = await zip.generateAsync({ type: 'blob' });
            
            const downloadUrl = window.URL.createObjectURL(content);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = `${viewRecord.work_order_number}_Serial_Generation.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            addToast(`TXT ZIP file downloaded successfully!`, 'success');
        } catch (err: any) {
            addToast(`Failed to generate TXT ZIP: ${err.message}`, 'error');
        } finally {
            setIsZipping(false);
        }
    };

    // Download All Serial Numbers and Metadata in a Styled Excel Spreadsheet
    const handleDownloadAllExcel = async () => {
        if (!viewRecord) return;
        setIsGeneratingExcel(true);
        try {
            addToast('Generating Excel report...', 'info');
            const blob = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${viewRecord.id}/export/excel`);
            
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = `${viewRecord.work_order_number}_Serial_Generation.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            addToast('Excel report downloaded successfully!', 'success');
        } catch (err: any) {
            addToast(`Failed to download Excel report: ${err.message}`, 'error');
        } finally {
            setIsGeneratingExcel(false);
        }
    };

    const handleDownloadLaserDocument = async (recordId: string, filename: string) => {
        try {
            addToast('Downloading document...', 'info');
            const blob = await apiFetch(`/api/smt/v1/smt/serial-generation-records/${recordId}/document/download`);
            if (blob instanceof Blob) {
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(downloadUrl);
                addToast('File downloaded successfully!', 'success');
            } else {
                addToast('Response was not a valid file binary stream.', 'error');
            }
        } catch (err: any) {
            addToast(`Download failed: ${err.message}`, 'error');
        }
    };

    // Calculate remaining quantity client-side
    const woRemainingQty = selectedWo 
        ? Math.max(0, selectedWo.quantity - Number(selectedWo.generated_count || 0))
        : 0;

    const currentPendingCount = barcodeSource === 'CUSTOMER'
        ? Math.max(0, (selectedWo?.quantity || 0) - (savedBarcodes.length + scannedBarcodes.length))
        : Math.max(0, woRemainingQty - scannedBarcodes.length);

    const getBarcodeSourceLabel = (src: string) => {
        if (src === 'GENERATE') return 'Generate Barcode';
        if (src === 'CUSTOMER') return 'Customer Barcode';
        if (src === 'LASER') return 'Laser Machine';
        return src;
    };

    return (
        <>
            <Toaster toasts={toasts} onRemove={removeToast} />
            <div className={styles.container}>
                
                {/* --- HEADER --- */}
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.headerTitle}>🔢 SMT Serial Number Generation</h2>
                        <p className={styles.headerSubtitle}>
                            Configure, scan, or upload serial number mappings for manufacturing work orders.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 650 }}>
                            👤 {smtUser?.name || 'Operator'} ({userRole})
                        </span>
                        <button
                            onClick={() => {
                                if (window.confirm("Are you sure you want to logout from SMT?")) {
                                    smtLogout();
                                }
                            }}
                            className={`${styles.button} ${styles.buttonSecondary}`}
                            style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                        >
                            Logout SMT
                        </button>
                    </div>
                </div>

                {/* --- MAIN GENERATION PANEL SPLIT --- */}
                <div className={styles.splitGrid}>
                    
                    {/* LEFT PANEL: WO SELECT & SNAPSHOT */}
                    <div className={styles.leftPanel}>
                        <div className={styles.card}>
                            <h3 className={styles.cardTitle}>📋 Select Work Order Queue</h3>
                            
                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Work Order ID *</label>
                                <WorkOrderSelector
                                    options={workOrders}
                                    value={selectedWoId}
                                    onChange={setSelectedWoId}
                                    placeholder="-- Choose Pending Work Order --"
                                    valueKey="id"
                                    labelKey="id"
                                    productNameKey="product_name"
                                    quantityKey="quantity"
                                    required
                                />
                            </div>

                            {selectedWo ? (
                                <>
                                    <h4 style={{ margin: '1.25rem 0 0.5rem 0', fontSize: '0.9rem', color: '#475569' }}>
                                        Work Order Snapshot Preview:
                                    </h4>
                                    <div className={styles.snapshotGrid}>
                                        <div className={styles.snapshotItem}>
                                            <span className={styles.snapshotLabel}>Product Name</span>
                                            <span className={styles.snapshotVal}>{selectedWo.product_name}</span>
                                        </div>
                                        <div className={styles.snapshotItem}>
                                            <span className={styles.snapshotLabel}>Work Order Qty</span>
                                            <span className={styles.snapshotVal}>{selectedWo.quantity}</span>
                                        </div>
                                        <div className={styles.snapshotItem}>
                                            <span className={styles.snapshotLabel}>Panel Qty</span>
                                            <span className={styles.snapshotVal}>{selectedWo.panel_quantity || 1}</span>
                                        </div>
                                        <div className={styles.snapshotItem}>
                                            <span className={styles.snapshotLabel}>Sides</span>
                                            <span className={styles.snapshotVal}>{selectedWo.sides || 'TOP'}</span>
                                        </div>
                                        <div className={styles.snapshotItem}>
                                            <span className={styles.snapshotLabel}>Line ID</span>
                                            <span className={styles.snapshotVal}>{selectedWo.line_id || 'Line 1'}</span>
                                        </div>
                                        <div className={styles.snapshotItem}>
                                            <span className={styles.snapshotLabel}>PO ID</span>
                                            <span className={styles.snapshotVal}>{selectedWo.po_id || '—'}</span>
                                        </div>
                                        <div className={`${styles.snapshotItem} ${styles.snapshotValLong}`}>
                                            <span className={styles.snapshotLabel}>Description</span>
                                            <span className={styles.snapshotVal}>{selectedWo.product_description || '—'}</span>
                                        </div>
                                        <div className={`${styles.snapshotItem} ${styles.snapshotValLong}`}>
                                            <span className={styles.snapshotLabel}>Work Order Remarks</span>
                                            <span className={styles.snapshotVal}>{selectedWo.remark || '—'}</span>
                                        </div>
                                        <div className={`${styles.snapshotItem} ${styles.snapshotValLong}`} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                                            <span className={styles.snapshotLabel} style={{ color: '#4f46e5' }}>Remaining Quantity Queue</span>
                                            <span className={styles.snapshotVal} style={{ fontSize: '1.15rem', color: '#4f46e5', fontWeight: 800 }}>
                                                {woRemainingQty}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className={`${styles.alert} ${styles.alertInfo}`} style={{ marginTop: '1.5rem' }}>
                                    Please select a work order to capture its snapshot and configure serial allocation.
                                </div>
                            )}

                            <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
                                <label className={styles.formLabel}>Remarks</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Enter generation record remarks..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.formLabel}>Additional Notes</label>
                                <textarea
                                    className={styles.textarea}
                                    rows={2}
                                    placeholder="Any additional notes or parameters..."
                                    value={additionalNotes}
                                    onChange={(e) => setAdditionalNotes(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL: DYNAMIC BARCODE CONFIGURATION */}
                    <div className={styles.rightPanel}>
                        <div className={styles.card} style={{ minHeight: '480px', display: 'flex', flexDirection: 'column' }}>
                            <h3 className={styles.cardTitle}>⚙️ Barcode Generation Settings</h3>

                            {/* BARCODE SOURCE CHOICE TABS */}
                            <div className={styles.tabsContainer}>
                                <button
                                    type="button"
                                    className={`${styles.tabBtn} ${barcodeSource === 'GENERATE' ? styles.tabBtnActive : ''}`}
                                    onClick={() => setBarcodeSource('GENERATE')}
                                >
                                    🔢 Generate Barcode
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.tabBtn} ${barcodeSource === 'CUSTOMER' ? styles.tabBtnActive : ''}`}
                                    onClick={() => setBarcodeSource('CUSTOMER')}
                                >
                                    👤 Customer Barcode
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.tabBtn} ${barcodeSource === 'LASER' ? styles.tabBtnActive : ''}`}
                                    onClick={() => setBarcodeSource('LASER')}
                                >
                                    ⚡ Laser Machine
                                </button>
                            </div>

                            {/* DYNAMIC CARD BODY CONTAINER */}
                            <div style={{ flex: 1 }}>
                                
                                {/* 1. GENERATE CARD CONTENT */}
                                {barcodeSource === 'GENERATE' && (
                                    <div>
                                        <div className={styles.formGroup}>
                                            <label className={styles.formLabel}>Panel/File Name</label>
                                            <input
                                                type="text"
                                                className={styles.input}
                                                placeholder="Enter panel/file name manually (e.g. P2523704001751)"
                                                value={panelFileName}
                                                onChange={(e) => {
                                                    setPanelFileName(e.target.value);
                                                    if (selectedWoId) {
                                                        localStorage.setItem(`panel_file_name_wo_${selectedWoId}`, e.target.value);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div className={styles.formGroup}>
                                                <label className={styles.formLabel}>Prefix</label>
                                                <input
                                                    type="text"
                                                    className={styles.input}
                                                    placeholder="e.g. SN"
                                                    value={prefix}
                                                    onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                                                />
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label className={styles.formLabel}>Suffix</label>
                                                <input
                                                    type="text"
                                                    className={styles.input}
                                                    placeholder="e.g. SMT"
                                                    value={suffix}
                                                    onChange={(e) => setSuffix(e.target.value.toUpperCase())}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                            <div className={styles.formGroup}>
                                                <label className={styles.formLabel}>Separator *</label>
                                                <select
                                                    className={styles.select}
                                                    value={separator}
                                                    onChange={(e) => setSeparator(e.target.value)}
                                                >
                                                    <option value="None">None</option>
                                                    <option value="Hyphen (-)">Hyphen (-)</option>
                                                    <option value="Underscore (_)">Underscore (_)</option>
                                                    <option value="Slash (/)">Slash (/)</option>
                                                    <option value="Space">Space</option>
                                                </select>
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label className={styles.formLabel}>Starting Number *</label>
                                                <input
                                                    type="number"
                                                    className={styles.input}
                                                    placeholder="e.g. 1"
                                                    value={startingNumber}
                                                    onChange={(e) => setStartingNumber(e.target.value)}
                                                />
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label className={styles.formLabel}>Ending Number *</label>
                                                <input
                                                    type="number"
                                                    className={styles.input}
                                                    placeholder="e.g. 100"
                                                    value={endingNumber}
                                                    onChange={(e) => setEndingNumber(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className={styles.formGroup} style={{ width: '50%' }}>
                                            <label className={styles.formLabel}>Min Digit Padding (optional)</label>
                                            <input
                                                type="number"
                                                className={styles.input}
                                                placeholder="e.g. 6 (gives 000001)"
                                                value={numberLength}
                                                onChange={(e) => setNumberLength(e.target.value)}
                                            />
                                        </div>

                                        {/* LIVE PREVIEW BOX */}
                                        {previewSerials.length > 0 && (
                                            <div className={styles.previewContainer}>
                                                <div className={styles.previewHeader}>
                                                    <span className={styles.previewTitle}>Live Generation Preview</span>
                                                    <span className={styles.previewCount}>
                                                        Total: {parseInt(endingNumber, 10) - parseInt(startingNumber, 10) + 1}
                                                    </span>
                                                </div>
                                                <div className={styles.previewSerialsList}>
                                                    {previewSerials.map((s, idx) => (
                                                        <span key={idx} className={styles.previewTag}>{s}</span>
                                                    ))}
                                                    {parseInt(endingNumber, 10) - parseInt(startingNumber, 10) + 1 > previewSerials.length && (
                                                        <span className={styles.previewTag} style={{ fontStyle: 'italic', background: '#e2e8f0' }}>
                                                            ... and {parseInt(endingNumber, 10) - parseInt(startingNumber, 10) + 1 - previewSerials.length} more.
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 2. CUSTOMER SCAN CARD CONTENT */}
                                {barcodeSource === 'CUSTOMER' && (() => {
                                    const totalScannedCount = savedBarcodes.length + scannedBarcodes.length;
                                    const isLimitReached = selectedWo ? totalScannedCount >= selectedWo.quantity : false;
                                    return (
                                        <div>
                                            {existingBatch && (
                                                <div className={`${styles.alert} ${styles.alertInfo}`} style={{ marginBottom: '1rem', borderLeft: '4px solid #3b82f6', backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.75rem' }}>
                                                    🔄 <strong>Resume Mode Active</strong>: Resuming existing Customer Barcode session. <strong>{savedBarcodes.length}</strong> barcodes already saved in the database.
                                                </div>
                                            )}

                                            <div className={styles.scanStats}>
                                                <div className={styles.scanStatItem}>
                                                    <span className={styles.scanStatLabel}>Scanned Count</span>
                                                    <span className={styles.scanStatVal} style={{ color: '#059669' }}>
                                                        {totalScannedCount}
                                                    </span>
                                                </div>
                                                <div className={styles.scanStatItem}>
                                                    <span className={styles.scanStatLabel}>Pending Count</span>
                                                    <span className={styles.scanStatVal} style={{ color: '#4f46e5' }}>
                                                        {currentPendingCount}
                                                    </span>
                                                </div>
                                            </div>

                                            <form onSubmit={handleScanSubmit} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                                <input
                                                    type="text"
                                                    className={styles.input}
                                                    placeholder={isLimitReached ? "Work Order quantity limit reached." : "Scan or type customer serial and press Enter..."}
                                                    value={scanInput}
                                                    onChange={(e) => setScanInput(e.target.value)}
                                                    disabled={isLimitReached}
                                                />
                                                <button type="submit" className={styles.button} style={{ backgroundColor: '#10b981' }} disabled={isLimitReached}>
                                                    Add
                                                </button>
                                            </form>

                                            {scannedBarcodes.length > 0 ? (
                                                <div className={styles.scanListContainer}>
                                                    {scannedBarcodes.map((bar, idx) => (
                                                        <div key={idx} className={styles.scanListItem}>
                                                            <div>
                                                                <span className={styles.scanListIndex}>#{scannedBarcodes.length - idx}</span>
                                                                <span className={styles.scanListBarcode}>{bar}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className={styles.fileRemoveBtn}
                                                                onClick={() => handleRemoveScan(idx)}
                                                                title="Delete Scan"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className={`${styles.alert} ${styles.alertWarning}`}>
                                                    {isLimitReached ? "All serial numbers have been scanned and saved." : "Scan queue is empty. Serial numbers will be registered under 'Customer Barcode' mapping."}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* 3. LASER MACHINE CARD CONTENT */}
                                {barcodeSource === 'LASER' && (
                                    <div>
                                        <div
                                            className={`${styles.dragArea} ${isDragging ? styles.dragAreaActive : ''}`}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => document.getElementById('laserFileInput')?.click()}
                                        >
                                            <input
                                                id="laserFileInput"
                                                type="file"
                                                style={{ display: 'none' }}
                                                accept=".pdf,.xls,.xlsx,.csv,.zip,.txt"
                                                onChange={handleFileChange}
                                            />
                                            <span className={styles.uploadIcon}>📁</span>
                                            <span className={styles.dragText}>
                                                Drag & Drop laser mapping document or <span style={{ color: '#4f46e5', textDecoration: 'underline' }}>Browse files</span>
                                            </span>
                                            <p className={styles.dragSubtext}>
                                                Supported formats: PDF, Excel (.xls, .xlsx), CSV, TXT, ZIP (Max 50MB)
                                            </p>
                                        </div>

                                        {laserFile && (
                                            <div className={styles.fileDetailCard}>
                                                <div className={styles.fileDetailInfo}>
                                                    <span className={styles.fileDetailIcon}>📄</span>
                                                    <div>
                                                        <div className={styles.fileDetailName}>{laserFile.name}</div>
                                                        <div className={styles.fileDetailSize}>
                                                            {isValidatingLaserFile ? (
                                                                <span style={{ color: '#4f46e5' }}>Validating & parsing file...</span>
                                                            ) : laserValidationData ? (
                                                                <span style={{ color: '#166534', fontWeight: 650 }}>
                                                                    {laserValidationData.serials.length} serial numbers extracted
                                                                </span>
                                                            ) : (
                                                                <span>{(laserFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles.fileRemoveBtn}
                                                    onClick={handleRemoveFile}
                                                    title="Remove File"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}

                                        <div className={`${styles.alert} ${styles.alertInfo}`} style={{ marginTop: '1.25rem' }}>
                                            ⚠️ Laser Machine configuration automatically compresses documents and runs Magic-Byte validation in the backend.
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* SUBMIT BUTTON CONTAINER */}
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                    disabled={isSubmitting}
                                >
                                    Reset
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateRecordSubmit}
                                    className={styles.button}
                                    disabled={isSubmitting || !selectedWoId}
                                >
                                    {isSubmitting ? 'Generating Serials...' : 'Generate Serials'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- SERIAL GENERATION RECORDS TABLE --- */}
                <div className={styles.card} style={{ marginTop: '2rem' }}>
                    <div className={styles.tableHeaderArea}>
                        <h3 style={{ margin: 0, border: 'none', padding: 0 }}>📊 Serial Generation Records</h3>
                        <div className={styles.tableFilters}>
                            <div className={styles.searchWrapper}>
                                <span className={styles.searchIcon}>🔍</span>
                                <input
                                    type="text"
                                    className={`${styles.input} ${styles.searchInput}`}
                                    placeholder="Search Work Order, Product..."
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Work Order Number</th>
                                    <th>Product Name</th>
                                    <th>Work Order Quantity</th>
                                    <th>Panel Quantity</th>
                                    <th>Barcode Source</th>
                                    <th>Scanned Count</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((rec) => (
                                    <tr key={rec.id}>
                                        <td style={{ fontWeight: 700, color: '#1e293b' }}>{rec.work_order_number}</td>
                                        <td style={{ fontWeight: 500 }}>{rec.product_name}</td>
                                        <td style={{ fontWeight: 600 }}>{rec.work_order_quantity}</td>
                                        <td>{rec.panel_quantity}</td>
                                        <td style={{ fontWeight: 600, color: '#4f46e5' }}>{getBarcodeSourceLabel(rec.barcode_source)}</td>
                                        <td style={{ fontWeight: 650 }}>{rec.generated_quantity}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                {rec.barcode_source === 'CUSTOMER' && rec.generated_quantity < rec.work_order_quantity && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartContinueScanning(rec)}
                                                        className={styles.button}
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#10b981', backgroundImage: 'none' }}
                                                    >
                                                        Continue Scanning
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => fetchRecordDetails(rec.id)}
                                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                                                >
                                                    View
                                                </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRecord(rec.id, rec.work_order_number)}
                                                        className={styles.buttonIconOnly}
                                                        title="Delete Record"
                                                    >
                                                        🗑️
                                                    </button>

                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {records.length === 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                            No serial generation records found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINATION CONTROLS */}
                    {totalPages > 1 && (
                        <div className={styles.pagination}>
                            <span className={styles.paginationText}>
                                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalRows} records)
                            </span>
                            <div className={styles.paginationControls}>
                                <button
                                    type="button"
                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                    style={{ padding: '0.5rem 0.85rem' }}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                    style={{ padding: '0.5rem 0.85rem' }}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- RECORD DETAILS MODAL --- */}
            {viewRecord && (
                <div className={styles.modalOverlay} onClick={() => setViewRecord(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', width: '90%' }}>
                        
                        {/* MODAL HEADER */}
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                🔍 Serial Generation Sheet: {viewRecord.work_order_number}
                            </h3>
                            <button type="button" className={styles.modalCloseBtn} onClick={() => setViewRecord(null)}>
                                ✕
                            </button>
                        </div>

                        {/* MODAL BODY */}
                        <div className={styles.modalBody} style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            {isLoadingDetails ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                    Loading details...
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    
                                    {/* SECTION 1: WORK ORDER INFORMATION */}
                                    <div className={styles.card} style={{ margin: 0, padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                                        <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontWeight: 700 }}>📋 Work Order Information</h4>
                                        <div className={styles.snapshotGrid} style={{ backgroundColor: '#fff' }}>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Work Order Number</span>
                                                <span className={styles.snapshotVal}>{viewRecord.work_order_number}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>PO ID</span>
                                                <span className={styles.snapshotVal}>{viewRecord.po_id}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Product Name</span>
                                                <span className={styles.snapshotVal}>{viewRecord.product_name}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Work Order Qty</span>
                                                <span className={styles.snapshotVal}>{viewRecord.work_order_quantity}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Panel Qty</span>
                                                <span className={styles.snapshotVal}>{viewRecord.panel_quantity}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Number of Sides</span>
                                                <span className={styles.snapshotVal}>{viewRecord.sides}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Line ID</span>
                                                <span className={styles.snapshotVal}>{viewRecord.line_id}</span>
                                            </div>
                                            <div className={`${styles.snapshotItem} ${styles.snapshotValLong}`}>
                                                <span className={styles.snapshotLabel}>Product Description</span>
                                                <span className={styles.snapshotVal}>{viewRecord.product_description || '—'}</span>
                                            </div>
                                            <div className={`${styles.snapshotItem} ${styles.snapshotValLong}`}>
                                                <span className={styles.snapshotLabel}>Work Order Remarks</span>
                                                <span className={styles.snapshotVal}>{viewRecord.work_order_remarks || '—'}</span>
                                            </div>
                                            {viewRecord.serial_generation_remarks && (
                                                <div className={`${styles.snapshotItem} ${styles.snapshotValLong}`} style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                                                    <span className={styles.snapshotLabel}>Generation Record Remarks</span>
                                                    <span className={styles.snapshotVal}>{viewRecord.serial_generation_remarks}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* SECTION 2: BARCODE INFORMATION */}
                                    <div className={styles.card} style={{ margin: 0, padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                                        <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontWeight: 700 }}>⚙️ Barcode Information</h4>
                                        <div className={styles.snapshotGrid} style={{ backgroundColor: '#fff' }}>
                                            <div className={styles.snapshotItem} style={{ gridColumn: 'span 2' }}>
                                                <span className={styles.snapshotLabel}>Barcode Source</span>
                                                <span className={styles.snapshotVal} style={{ fontWeight: 700, color: '#4f46e5' }}>{getBarcodeSourceLabel(viewRecord.barcode_source)}</span>
                                            </div>

                                            {viewRecord.barcode_source === 'GENERATE' && recordMetadata && (
                                                <>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Prefix</span>
                                                        <span className={styles.snapshotVal}>{recordMetadata.prefix || '—'}</span>
                                                    </div>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Suffix</span>
                                                        <span className={styles.snapshotVal}>{recordMetadata.suffix || '—'}</span>
                                                    </div>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Separator</span>
                                                        <span className={styles.snapshotVal}>{recordMetadata.separator}</span>
                                                    </div>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Starting Number</span>
                                                        <span className={styles.snapshotVal}>{recordMetadata.starting_number}</span>
                                                    </div>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Ending Number</span>
                                                        <span className={styles.snapshotVal}>{recordMetadata.ending_number}</span>
                                                    </div>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Number Length</span>
                                                        <span className={styles.snapshotVal}>{recordMetadata.number_length || '—'}</span>
                                                    </div>
                                                </>
                                            )}

                                            {viewRecord.barcode_source === 'CUSTOMER' && recordMetadata && (
                                                <>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Total Scanned</span>
                                                        <span className={styles.snapshotVal}>{recordMetadata.total_scanned}</span>
                                                    </div>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Duplicate Scan Count</span>
                                                        <span className={styles.snapshotVal} style={{ color: '#dc2626' }}>{recordMetadata.duplicate_scan_count}</span>
                                                    </div>
                                                    <div className={`${styles.snapshotItem} ${styles.snapshotValLong}`}>
                                                        <span className={styles.snapshotLabel}>Scanned Barcode Details</span>
                                                        <div style={{ marginTop: '0.5rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '0.375rem', padding: '0.5rem' }}>
                                                            {Array.isArray(recordMetadata.duplicate_scan_log) && recordMetadata.duplicate_scan_log.length > 0 ? (
                                                                recordMetadata.duplicate_scan_log.map((log: any, i: number) => (
                                                                    <div key={i} style={{ padding: '0.4rem', fontSize: '0.8rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ fontFamily: 'monospace' }}>{log.barcode}</span>
                                                                        <span style={{ color: '#64748b' }}>{log.scannedAt}</span>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>No scan events logged.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {viewRecord.barcode_source === 'LASER' && recordMetadata && (
                                                <>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Original Filename</span>
                                                        <span className={styles.snapshotVal}>{recordMetadata.original_filename}</span>
                                                    </div>
                                                    <div className={styles.snapshotItem}>
                                                        <span className={styles.snapshotLabel}>Original Size</span>
                                                        <span className={styles.snapshotVal}>{(recordMetadata.original_size / 1024).toFixed(1)} KB</span>
                                                    </div>
                                                    <div className={`${styles.snapshotItem} ${styles.snapshotValLong}`}>
                                                        <span className={styles.snapshotLabel}>Uploaded Document Information</span>
                                                        <div style={{ marginTop: '0.5rem' }}>
                                                            <button
                                                                type="button"
                                                                className={`${styles.button} ${styles.buttonSecondary}`}
                                                                onClick={() => handleDownloadLaserDocument(viewRecord.id, recordMetadata.original_filename)}
                                                            >
                                                                📥 Download Laser File
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* SECTION 3: GENERATED SERIAL NUMBERS */}
                                    <div className={styles.card} style={{ margin: 0, padding: '1.25rem', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                            <div>
                                                <h4 style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
                                                    🔢 Generated Serial Numbers ({viewRecord.generated_quantity})
                                                </h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                                    <div className={styles.formGroup} style={{ margin: 0, minWidth: '220px' }}>
                                                        <input
                                                            type="text"
                                                            className={styles.input}
                                                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                                                            placeholder="Panel/File Name"
                                                            value={modalPanelFileName}
                                                            onChange={(e) => {
                                                                setModalPanelFileName(e.target.value);
                                                                localStorage.setItem(`panel_file_name_${viewRecord.id}`, e.target.value);
                                                                localStorage.setItem(`panel_file_name_wo_${viewRecord.work_order_id}`, e.target.value);
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        <button
                                                            type="button"
                                                            onClick={handleDownloadAllQRCodesPNG}
                                                            className={styles.button}
                                                            disabled={isZipping || isGeneratingExcel}
                                                            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', backgroundColor: '#10b981' }}
                                                        >
                                                            {isZipping && !pdfProgress ? '🔄 zipping PNGs...' : '📦 Download All PNG'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleDownloadAllQRCodesPDF}
                                                            className={styles.button}
                                                            disabled={isZipping || isGeneratingExcel}
                                                            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', backgroundColor: '#4f46e5' }}
                                                        >
                                                            {pdfProgress ? `🔄 ${pdfProgress}` : (isZipping ? '🔄 creating PDF...' : '📄 Download All PDF')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleDownloadAllTXT}
                                                            className={styles.button}
                                                            disabled={isZipping || isGeneratingExcel}
                                                            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', backgroundColor: '#d97706' }}
                                                        >
                                                            {isZipping && !pdfProgress ? '🔄 creating TXT...' : '📝 Download All TXT'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleDownloadAllExcel}
                                                            className={styles.button}
                                                            disabled={isZipping || isGeneratingExcel}
                                                            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', backgroundColor: '#2563eb' }}
                                                        >
                                                            {isGeneratingExcel ? '🔄 creating Excel...' : '📊 Download All Excel'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={styles.searchWrapper} style={{ width: '220px' }}>
                                                <span className={styles.searchIcon}>🔍</span>
                                                <input
                                                    type="text"
                                                    className={`${styles.input} ${styles.searchInput}`}
                                                    placeholder="Search serial number..."
                                                    value={serialsSearch}
                                                    onChange={(e) => { setSerialsSearch(e.target.value); setSerialsPage(1); }}
                                                />
                                            </div>
                                        </div>

                                        <div className={styles.tableContainer}>
                                            <table className={styles.table} style={{ fontSize: '0.85rem' }}>
                                                <thead>
                                                    <tr>
                                                        <th>Serial Number</th>
                                                        <th>QR Code</th>
                                                        <th>Generated Date</th>
                                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {recordSerials.map((s) => (
                                                        <tr key={s.id}>
                                                            <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.serial_number}</td>
                                                            <td>
                                                                {qrCodeMap[s.serial_number] ? (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                                                        <img 
                                                                            src={qrCodeMap[s.serial_number]} 
                                                                            alt="QR Code Composite" 
                                                                            style={{ width: '70px', height: '83px', display: 'block', border: '1px solid #cbd5e1', padding: '2px', borderRadius: '4px', backgroundColor: '#fff' }} 
                                                                        />
                                                                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#475569' }}>
                                                                            {s.serial_number}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Generating...</span>
                                                                )}
                                                            </td>
                                                            <td style={{ color: '#64748b' }}>{new Date(s.created_at).toLocaleString()}</td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPreviewQrSerial(s.serial_number)}
                                                                        className={`${styles.button} ${styles.buttonSecondary}`}
                                                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                                                                    >
                                                                        View QR
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDownloadSingleQR(s.serial_number)}
                                                                        className={`${styles.button} ${styles.buttonSecondary}`}
                                                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#166534', borderColor: '#86efac' }}
                                                                    >
                                                                        PNG
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDownloadSinglePDF(s.serial_number)}
                                                                        className={`${styles.button} ${styles.buttonSecondary}`}
                                                                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#1e40af', borderColor: '#bfdbfe' }}
                                                                    >
                                                                        PDF
                                                                    </button>
                                                                    {viewRecord?.barcode_source === 'CUSTOMER' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenEditModal(s)}
                                                                            className={`${styles.button} ${styles.buttonSecondary}`}
                                                                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#d97706', borderColor: '#fcd34d' }}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {recordSerials.length === 0 && (
                                                        <tr>
                                                            <td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                                                                No serial numbers found.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {serialsTotalPages > 1 && (
                                            <div className={styles.pagination} style={{ borderTop: 'none', marginTop: '1rem' }}>
                                                <span className={styles.paginationText}>
                                                    Page <strong>{serialsPage}</strong> of <strong>{serialsTotalPages}</strong>
                                                </span>
                                                <div className={styles.paginationControls}>
                                                    <button
                                                        type="button"
                                                        className={`${styles.button} ${styles.buttonSecondary}`}
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                                                        onClick={() => setSerialsPage(p => Math.max(1, p - 1))}
                                                        disabled={serialsPage === 1}
                                                    >
                                                        Prev
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`${styles.button} ${styles.buttonSecondary}`}
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                                                        onClick={() => setSerialsPage(p => Math.min(serialsTotalPages, p + 1))}
                                                        disabled={serialsPage === serialsTotalPages}
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* SECTION 4: AUDIT INFORMATION */}
                                    <div className={styles.card} style={{ margin: 0, padding: '1.25rem', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                        <h4 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontWeight: 700 }}>🛡️ Audit Information</h4>
                                        <div className={styles.snapshotGrid} style={{ backgroundColor: 'transparent' }}>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Created By</span>
                                                <span className={styles.snapshotVal}>{viewRecord.created_by_name || viewRecord.created_by}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Created At</span>
                                                <span className={styles.snapshotVal}>{new Date(viewRecord.created_at).toLocaleString()}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Updated By</span>
                                                <span className={styles.snapshotVal}>{viewRecord.updated_by_name || viewRecord.updated_by || '—'}</span>
                                            </div>
                                            <div className={styles.snapshotItem}>
                                                <span className={styles.snapshotLabel}>Updated At</span>
                                                <span className={styles.snapshotVal}>{viewRecord.updated_at ? new Date(viewRecord.updated_at).toLocaleString() : '—'}</span>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- QR CODE LARGE PREVIEW MODAL --- */}
            {previewQrSerial && (
                <div className={styles.modalOverlay} onClick={() => setPreviewQrSerial(null)} style={{ zIndex: 1100 }}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', borderRadius: '1rem', border: '1px solid #cbd5e1' }}>
                        
                        <div className={styles.modalHeader} style={{ padding: '0.85rem 1.5rem', backgroundColor: '#f8fafc' }}>
                            <h4 style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>🔍 QR Code Preview</h4>
                            <button type="button" className={styles.modalCloseBtn} onClick={() => setPreviewQrSerial(null)}>✕</button>
                        </div>

                        <div className={styles.modalBody} style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#ffffff' }}>
                            {qrCodeMap[previewQrSerial] ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                    <img 
                                        src={qrCodeMap[previewQrSerial]} 
                                        alt="Large QR Code" 
                                        style={{ width: '220px', height: '260px', display: 'block', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '8px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} 
                                    />
                                    <span style={{ fontSize: '1.05rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#0f172a', letterSpacing: '0.025em' }}>
                                        {previewQrSerial}
                                    </span>
                                </div>
                            ) : (
                                <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                    Generating preview...
                                </div>
                            )}

                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadSingleQR(previewQrSerial)}
                                        className={styles.button}
                                        style={{ backgroundColor: '#10b981', padding: '0.55rem', fontSize: '0.85rem' }}
                                    >
                                        Download PNG
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadSinglePDF(previewQrSerial)}
                                        className={styles.button}
                                        style={{ backgroundColor: '#4f46e5', padding: '0.55rem', fontSize: '0.85rem' }}
                                    >
                                        Download PDF
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPreviewQrSerial(null)}
                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                    style={{ padding: '0.55rem', fontSize: '0.85rem', width: '100%' }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* --- LASER MISMATCH WARNING MODAL --- */}
            {showLaserMismatchModal && laserMismatchDetails && (
                <div className={styles.modalOverlay} onClick={handleCancelLaserMismatch} style={{ zIndex: 1200 }}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '95%', borderRadius: '1rem' }}>
                        <div className={styles.modalHeader} style={{ backgroundColor: '#fff3cd', borderBottom: '1px solid #ffeeba' }}>
                            <h3 className={styles.modalTitle} style={{ color: '#856404', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ⚠️ Warning: Quantity Mismatch
                            </h3>
                        </div>
                        <div className={styles.modalBody} style={{ padding: '1.5rem 2rem' }}>
                            <p style={{ margin: '0 0 1.25rem 0', color: '#664d03', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                The number of serial numbers extracted from the file does not match the remaining Work Order quantity.
                            </p>
                            <div style={{ backgroundColor: '#fcf8e3', border: '1px solid #faf2cc', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#856404', fontWeight: 600 }}>
                                    <span>Remaining Work Order Qty:</span>
                                    <span>{laserMismatchDetails.remainingQty}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#856404', fontWeight: 600 }}>
                                    <span>File Serial Count:</span>
                                    <span>{laserMismatchDetails.fileCount}</span>
                                </div>
                            </div>
                            <p style={{ margin: '0 0 1.5rem 0', fontWeight: 700, color: '#212529', textAlign: 'center' }}>
                                Do you want to continue?
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={handleCancelLaserMismatch}
                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                    style={{ borderColor: '#ffeeba', color: '#856404' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleContinueLaserMismatch}
                                    className={styles.button}
                                    style={{ backgroundColor: '#ffc107', backgroundImage: 'none', color: '#212529', boxShadow: 'none' }}
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- CONTINUE SCANNING RESUME MODAL --- */}
            {continueScanRecord && (
                <div className={styles.modalOverlay} onClick={handleCloseContinueScan} style={{ zIndex: 1150 }}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px', width: '95%', borderRadius: '1.25rem' }}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                👤 Continue Scanning: {continueScanRecord.work_order_number}
                            </h3>
                            <button type="button" className={styles.modalCloseBtn} onClick={handleCloseContinueScan}>✕</button>
                        </div>
                        <div className={styles.modalBody} style={{ padding: '1.5rem 2rem' }}>
                            <div className={styles.snapshotGrid} style={{ marginTop: 0, marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem' }}>
                                <div className={styles.snapshotItem}>
                                    <span className={styles.snapshotLabel}>Product Name</span>
                                    <span className={styles.snapshotVal}>{continueScanRecord.product_name}</span>
                                </div>
                                <div className={styles.snapshotItem}>
                                    <span className={styles.snapshotLabel}>WO Quantity</span>
                                    <span className={styles.snapshotVal}>{continueScanRecord.work_order_quantity}</span>
                                </div>
                            </div>

                            <div className={styles.scanStats} style={{ marginBottom: '1.5rem' }}>
                                <div className={styles.scanStatItem}>
                                    <span className={styles.scanStatLabel}>Scanned Count</span>
                                    <span className={styles.scanStatVal} style={{ color: '#059669' }}>
                                        {continueScannedCount}
                                    </span>
                                </div>
                                <div className={styles.scanStatItem}>
                                    <span className={styles.scanStatLabel}>Pending Count</span>
                                    <span className={styles.scanStatVal} style={{ color: '#4f46e5' }}>
                                        {continueScanRecord.work_order_quantity - continueScannedCount}
                                    </span>
                                </div>
                            </div>

                            <form onSubmit={handleContinueScanSubmit} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Scan customer serial and press Enter..."
                                    value={continueScanInput}
                                    onChange={(e) => setContinueScanInput(e.target.value)}
                                    autoFocus
                                    disabled={continueScannedCount >= continueScanRecord.work_order_quantity}
                                />
                                <button 
                                    type="submit" 
                                    className={styles.button} 
                                    style={{ backgroundColor: '#10b981' }}
                                    disabled={continueScannedCount >= continueScanRecord.work_order_quantity || isSubmittingContinueScan}
                                >
                                    Add
                                </button>
                            </form>

                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#475569' }}>Recently Scanned Barcodes:</h4>
                            <div className={styles.scanListContainer} style={{ maxHeight: '180px' }}>
                                {continueScannedSerials.map((bar, idx) => (
                                    <div key={idx} className={styles.scanListItem}>
                                        <div>
                                            <span className={styles.scanListIndex}>#{continueScannedSerials.length - idx}</span>
                                            <span className={styles.scanListBarcode}>{bar}</span>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>Saved</span>
                                    </div>
                                ))}
                                {continueScannedSerials.length === 0 && (
                                    <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                                        No scans found for this record yet. Start scanning above!
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    onClick={handleCloseContinueScan}
                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- EDIT CUSTOMER BARCODE MODAL --- */}
            {editingSerial && (
                <div className={styles.modalOverlay} onClick={() => setEditingSerial(null)} style={{ zIndex: 1200 }}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%', borderRadius: '1rem', border: '1px solid #cbd5e1' }}>
                        
                        <div className={styles.modalHeader} style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc' }}>
                            <h4 className={styles.modalTitle} style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>✏️ Edit Customer Barcode</h4>
                            <button type="button" className={styles.modalCloseBtn} onClick={() => setEditingSerial(null)}>✕</button>
                        </div>

                        <div className={styles.modalBody} style={{ padding: '1.5rem', backgroundColor: '#ffffff' }}>
                            <div style={{ marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                    <span style={{ fontWeight: 600, color: '#64748b' }}>Work Order:</span>
                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{viewRecord?.work_order_number}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontWeight: 600, color: '#64748b' }}>Product:</span>
                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{viewRecord?.product_name}</span>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontWeight: 700, color: '#374151', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>Customer Barcode</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={editBarcodeValue}
                                    onChange={(e) => setEditBarcodeValue(e.target.value)}
                                    placeholder="Enter customer barcode..."
                                    autoFocus
                                    disabled={isSavingEdit}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditingSerial(null)}
                                    className={`${styles.button} ${styles.buttonSecondary}`}
                                    style={{ padding: '0.5rem 1rem' }}
                                    disabled={isSavingEdit}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveEditBarcode}
                                    className={styles.button}
                                    style={{ padding: '0.5rem 1rem', backgroundColor: '#4f46e5' }}
                                    disabled={isSavingEdit}
                                >
                                    {isSavingEdit ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </>
    );
};

export default SerialNumber;
