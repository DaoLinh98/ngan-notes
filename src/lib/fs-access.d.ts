/**
 * The parts of the File System Access API that TypeScript's DOM lib does not
 * ship yet: `showSaveFilePicker` and the permission methods on a handle.
 * Delete this file once lib.dom declares them.
 */

interface FileSystemHandle {
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface Window {
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: { description?: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle>;
}
