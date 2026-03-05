"use client";

import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Loader2, ImageIcon, Camera } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadedFile {
  file: File;
  preview: string;
  id?: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  progress: number;
}

interface ImageDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  uploadedFiles: UploadedFile[];
  onRemoveFile: (index: number) => void;
  isUploading: boolean;
  maxFiles?: number;
}

export function ImageDropzone({
  onFilesSelected,
  uploadedFiles,
  onRemoveFile,
  isUploading,
  maxFiles = 10,
}: ImageDropzoneProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesSelected(acceptedFiles);
    },
    [onFilesSelected],
  );

  const handleCameraCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const capturedFiles = Array.from(e.target.files ?? []);
      if (capturedFiles.length > 0) {
        onFilesSelected(capturedFiles);
      }
      // Reset so the same file can be captured again
      e.target.value = "";
    },
    [onFilesSelected],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/heic": [".heic"],
      "image/heif": [".heif"],
      "image/webp": [".webp"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles,
    disabled: isUploading,
  });

  return (
    <div className="space-y-4">
      {/* Hidden camera input — opens device camera directly (bypasses Google Photos) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
        disabled={isUploading}
      />

      {/* Camera capture button — mobile-friendly shortcut */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-dashed"
        disabled={isUploading}
        onClick={() => cameraInputRef.current?.click()}
      >
        <Camera className="h-4 w-4" />
        カメラで撮影する
      </Button>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          isUploading && "cursor-not-allowed opacity-50",
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm font-medium">ここにドロップしてください</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              ギャラリーから選択 / ドラッグ＆ドロップ
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPEG, PNG, HEIC, WebP（最大10MB / 最大{maxFiles}枚）
            </p>
          </>
        )}
      </div>

      {/* Preview grid */}
      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {uploadedFiles.map((file, index) => (
            <div
              key={`${file.file.name}-${index}`}
              className="group relative overflow-hidden rounded-lg border bg-muted"
            >
              <div className="relative aspect-square">
                {file.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {/* Status overlay */}
                {file.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}

                {file.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/40">
                    <span className="text-xs font-medium text-white">
                      エラー
                    </span>
                  </div>
                )}

                {file.status === "success" && (
                  <div className="absolute right-1 top-1 rounded-full bg-green-500 p-0.5">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}

                {/* Remove button */}
                {!isUploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(index);
                    }}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {file.status === "uploading" && (
                <div className="px-2 py-1">
                  <Progress value={file.progress} className="h-1" />
                </div>
              )}

              {/* File name */}
              <div className="px-2 py-1">
                <p className="truncate text-xs text-muted-foreground">
                  {file.file.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
