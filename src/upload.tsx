import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';

// Type definitions
interface ImageFile {
  file: File;
  preview: string;
  id: string;
  size: number;
  type: string;
  lastModified: number;
}

interface ValidationError {
  type: 'size' | 'format' | 'dimensions' | 'security' | 'general';
  message: string;
}

interface ImageUploadProps {
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedFormats?: string[];
  maxWidth?: number;
  maxHeight?: number;
  onUpload?: (files: ImageFile[]) => void;
  onError?: (errors: ValidationError[]) => void;
  className?: string;
}

interface UploadState {
  files: ImageFile[];
  errors: ValidationError[];
  isUploading: boolean;
  dragActive: boolean;
}

const SecureImageUpload: React.FC<ImageUploadProps> = ({
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB default
  acceptedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  maxWidth = 4000,
  maxHeight = 4000,
  onUpload,
  onError,
  className = ''
}) => {
  const [state, setState] = useState<UploadState>({
    files: [],
    errors: [],
    isUploading: false,
    dragActive: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security validation functions
  const validateFileSignature = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arr = new Uint8Array(e.target?.result as ArrayBuffer).subarray(0, 4);
        let header = '';
        for (let i = 0; i < arr.length; i++) {
          header += arr[i].toString(16).padStart(2, '0');
        }
        
        // Check magic numbers for common image formats
        const validSignatures = {
          'ffd8ffe0': 'jpeg', // JPEG
          'ffd8ffe1': 'jpeg', // JPEG
          'ffd8ffe2': 'jpeg', // JPEG
          'ffd8ffe3': 'jpeg', // JPEG
          'ffd8ffe8': 'jpeg', // JPEG
          '89504e47': 'png',  // PNG
          '47494638': 'gif',  // GIF
          '52494646': 'webp', // WEBP (starts with RIFF)
        };
        
        const isValid = Object.keys(validSignatures).some(signature => 
          header.startsWith(signature.toLowerCase())
        );
        resolve(isValid);
      };
      reader.readAsArrayBuffer(file.slice(0, 4));
    });
  };

  const validateImageDimensions = (file: File): Promise<{ width: number; height: number; valid: boolean }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        const valid = img.width <= maxWidth && img.height <= maxHeight;
        resolve({ width: img.width, height: img.height, valid });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0, valid: false });
      };
      
      img.src = url;
    });
  };

  const validateFile = async (file: File): Promise<ValidationError[]> => {
    const errors: ValidationError[] = [];

    // File size validation
    if (file.size > maxSize) {
      errors.push({
        type: 'size',
        message: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`
      });
    }

    // MIME type validation
    if (!acceptedFormats.includes(file.type)) {
      errors.push({
        type: 'format',
        message: `File format ${file.type} is not allowed. Accepted formats: ${acceptedFormats.join(', ')}`
      });
    }

    // Security: Validate file signature
    const hasValidSignature = await validateFileSignature(file);
    if (!hasValidSignature) {
      errors.push({
        type: 'security',
        message: 'File signature validation failed. This may not be a valid image file.'
      });
    }

    // Dimension validation (only for valid image files)
    if (hasValidSignature) {
      try {
        const dimensions = await validateImageDimensions(file);
        if (!dimensions.valid) {
          errors.push({
            type: 'dimensions',
            message: `Image dimensions (${dimensions.width}x${dimensions.height}) exceed maximum allowed size (${maxWidth}x${maxHeight})`
          });
        }
      } catch (error) {
        errors.push({
          type: 'general',
          message: 'Failed to validate image dimensions'
        });
      }
    }

    return errors;
  };

  const processFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    
    setState(prev => ({ ...prev, isUploading: true, errors: [] }));

    // Check file count limit
    if (state.files.length + files.length > maxFiles) {
      const error: ValidationError = {
        type: 'general',
        message: `Cannot upload more than ${maxFiles} files. Current: ${state.files.length}, Attempting to add: ${files.length}`
      };
      setState(prev => ({ ...prev, errors: [error], isUploading: false }));
      onError?.([error]);
      return;
    }

    const processedFiles: ImageFile[] = [];
    const allErrors: ValidationError[] = [];

    for (const file of files) {
      // Sanitize filename
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const sanitizedFile = new File([file], sanitizedName, { type: file.type });

      const errors = await validateFile(sanitizedFile);
      
      if (errors.length === 0) {
        const imageFile: ImageFile = {
          file: sanitizedFile,
          preview: URL.createObjectURL(sanitizedFile),
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          size: sanitizedFile.size,
          type: sanitizedFile.type,
          lastModified: sanitizedFile.lastModified
        };
        processedFiles.push(imageFile);
      } else {
        allErrors.push(...errors);
      }
    }

    setState(prev => ({
      ...prev,
      files: [...prev.files, ...processedFiles],
      errors: allErrors,
      isUploading: false
    }));

    if (processedFiles.length > 0) {
      onUpload?.(processedFiles);
    }

    if (allErrors.length > 0) {
      onError?.(allErrors);
    }
  }, [state.files.length, maxFiles, maxSize, acceptedFormats, maxWidth, maxHeight, onUpload, onError]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, dragActive: false }));
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, dragActive: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setState(prev => ({ ...prev, dragActive: false }));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const removeFile = useCallback((id: string) => {
    setState(prev => {
      const updatedFiles = prev.files.filter(file => {
        if (file.id === id) {
          URL.revokeObjectURL(file.preview);
          return false;
        }
        return true;
      });
      return { ...prev, files: updatedFiles };
    });
  }, []);

  const clearAll = useCallback(() => {
    state.files.forEach(file => URL.revokeObjectURL(file.preview));
    setState(prev => ({ ...prev, files: [], errors: [] }));
  }, [state.files]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      state.files.forEach(file => URL.revokeObjectURL(file.preview));
    };
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`w-full max-w-4xl mx-auto p-6 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${state.dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${state.isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFormats.join(',')}
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={state.isUploading}
        />
        
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 bg-gray-100 rounded-full">
            <Upload className="w-8 h-8 text-gray-600" />
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {state.isUploading ? 'Processing files...' : 'Drop images here or click to browse'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Max {maxFiles} files, {formatFileSize(maxSize)} each
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supported: {acceptedFormats.map(format => format.split('/')[1].toUpperCase()).join(', ')}
            </p>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {state.errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-medium text-red-800">Upload Errors</h3>
          </div>
          <ul className="space-y-1">
            {state.errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700">
                • {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* File List */}
      {state.files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Uploaded Images ({state.files.length}/{maxFiles})
            </h3>
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-800 transition-colors"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.files.map((imageFile) => (
              <div key={imageFile.id} className="relative group bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                  <img
                    src={imageFile.preview}
                    alt={imageFile.file.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        const icon = document.createElement('div');
                        icon.innerHTML = '<svg class="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
                        icon.className = 'flex items-center justify-center';
                        parent.appendChild(icon);
                      }
                    }}
                  />
                </div>
                
                <button
                  onClick={() => removeFile(imageFile.id)}
                  className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 truncate" title={imageFile.file.name}>
                    {imageFile.file.name}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">
                      {formatFileSize(imageFile.size)}
                    </span>
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-600">Valid</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SecureImageUpload;