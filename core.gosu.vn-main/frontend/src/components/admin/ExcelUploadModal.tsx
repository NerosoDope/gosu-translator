'use client';

import React, { useState, useRef } from 'react';
import { useToastContext } from '@/context/ToastContext';
import { filesAPI, importBatchesAPI, jobAPI } from '@/lib/api';
import { authStore } from '@/lib/auth';

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  uploadFunction: (file: File, gameId?: number) => Promise<any>;
  title?: string;
  gameId?: number;
  /** Khi truyền vào, sau khi upload thành công sẽ tự tạo job_type='glossary_update' */
  glossaryType?: 'game_glossary' | 'global_glossary';
}

export default function ExcelUploadModal({
  isOpen,
  onClose,
  onSuccess,
  uploadFunction,
  title = 'Upload Excel File',
  gameId,
  glossaryType,
}: ExcelUploadModalProps) {
  const { success: showToast, error: showErrorToast } = useToastContext();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
        showErrorToast('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
        return;
      }
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      showErrorToast('Vui lòng chọn file để upload');
      return;
    }

    try {
      setUploading(true);
      let minioFailed = false;
      // Bước 1: Upload file lên MinIO để lưu trữ
      try {
        await filesAPI.upload(file);
      } catch (error: any) {
        console.error('Upload to MinIO failed:', error);
        minioFailed = true;
      }

      // Bước 2: Gọi API import Excel vào DB
      const result = await uploadFunction(file, gameId);
      setUploadResult(result.data);
      
      if (result.data.success) {
        const { created_count = 0, skipped_count = 0 } = result.data;
        let msg = minioFailed
          ? `Đã import ${created_count} bản ghi thành công. (File chưa lưu vào MinIO)`
          : `Upload thành công! Đã tạo ${created_count} bản ghi.`;
        if (skipped_count > 0) {
          msg += ` Bỏ qua ${skipped_count} dòng đã tồn tại.`;
        }
        showToast(msg);

        // Tạo job glossary_update nếu được yêu cầu
        if (glossaryType) {
          try {
            const user = await authStore.getCurrentUser();
            if (user?.id) {
              const jobCode = `GLOSSARY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
              await jobAPI.create({
                job_code: jobCode,
                job_type: 'glossary_update',
                status: 'completed',
                progress: 100,
                user_id: user.id,
                payload: {
                  glossary_type: glossaryType,
                  ...(gameId != null ? { game_id: gameId } : {}),
                  filename: file.name,
                  total_rows: result.data.total_rows ?? 0,
                  created_count,
                  skipped_count,
                },
                result: {
                  created_count,
                  skipped_count,
                  error_count: result.data.error_count ?? 0,
                  saved_at: new Date().toISOString(),
                },
              });
            }
          } catch {
            // Không chặn flow chính nếu tạo job thất bại
          }
        }

        onSuccess();
      } else {
        showErrorToast(`Upload hoàn tất nhưng có ${result.data.error_count} lỗi.`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Có lỗi xảy ra khi upload file';
      showErrorToast(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleRollback = async () => {
    if (!uploadResult?.import_id || uploadResult.created_count === 0) return;
    try {
      setRollingBack(true);
      const res = await importBatchesAPI.rollback(uploadResult.import_id);
      const data = res.data;
      showToast(data.message || `Đã xoá ${data.deleted_count} bản ghi vừa import.`);
      onSuccess();
      setUploadResult(null);
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message || 'Lỗi khi hoàn tác import';
      showErrorToast(msg);
    } finally {
      setRollingBack(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.match(/\.(xlsx|xls)$/i)) {
      setFile(droppedFile);
      setUploadResult(null);
    } else {
      showErrorToast('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Đóng"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content: 2 cột - Trái: kết quả + hướng dẫn, Phải: vùng upload file */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cột trái: Kết quả upload + Hướng dẫn */}
          <div className="space-y-4 flex flex-col min-h-0">
            {/* Upload Result */}
            {uploadResult ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden flex flex-col min-h-0 max-h-[220px]">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex-shrink-0">Kết quả upload:</h4>
                <div className="space-y-2 text-sm flex-1 min-h-0 overflow-y-auto">
                  <div className="flex justify-between flex-shrink-0">
                    <span className="text-gray-600 dark:text-gray-400">Tổng số dòng:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{uploadResult.total_rows}</span>
                  </div>
                  <div className="flex justify-between flex-shrink-0">
                    <span className="text-gray-600 dark:text-gray-400">Đã tạo:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{uploadResult.created_count}</span>
                  </div>
                  {uploadResult.skipped_count > 0 && (
                    <div className="flex justify-between flex-shrink-0">
                      <span className="text-gray-600 dark:text-gray-400">Bỏ qua (đã tồn tại):</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">{uploadResult.skipped_count}</span>
                    </div>
                  )}
                  <div className="flex justify-between flex-shrink-0">
                    <span className="text-gray-600 dark:text-gray-400">Lỗi:</span>
                    <span className="font-medium text-red-600 dark:text-red-400">{uploadResult.error_count}</span>
                  </div>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-3 flex-shrink-0">
                      <p className="text-gray-600 dark:text-gray-400 mb-1">Chi tiết lỗi:</p>
                      <div className="max-h-24 overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600">
                        {uploadResult.errors.map((error: string, index: number) => (
                          <p key={index} className="text-xs text-red-600 dark:text-red-400 break-words">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Instructions - luôn hiển thị bên trái, không bị đè */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Hướng dẫn:</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>File Excel phải có header ở dòng đầu tiên</li>
                <li>Các cột bắt buộc: term, translated_term, language_pair</li>
                <li>Các cột tùy chọn: game_category_id (hoặc game_id), usage_count, is_active</li>
              </ul>
            </div>
          </div>

          {/* Cột phải: File Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors flex flex-col justify-center min-h-[200px] ${
              file
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
            }`}
          >
            {file ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <svg className="w-14 h-14 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-medium text-gray-900 dark:text-gray-100 break-all">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Xóa file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <svg className="w-14 h-14 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                    Kéo thả file Excel vào đây
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    hoặc click để chọn file
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Hỗ trợ định dạng .xlsx và .xls
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excel-file-input"
                />
                <label
                  htmlFor="excel-file-input"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                >
                  Chọn file
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          {uploadResult?.import_id != null && uploadResult?.created_count > 0 && (
            <button
              onClick={handleRollback}
              disabled={rollingBack}
              className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              {rollingBack ? 'Đang xoá...' : 'Hoàn tác import'}
            </button>
          )}
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
          >
            {uploadResult ? 'Đóng' : 'Hủy'}
          </button>
          {!uploadResult && (
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Đang upload...' : 'Upload'}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
