import { FileText as IconFileText, Search as IconSearch, Trash2 as IconTrash2, Upload as IconUpload } from './Icons';
import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import googleDriveService from '../../services/googleDriveService';

const GoogleDriveViewer = () => {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setUser(tokenResponse);
      googleDriveService.setAccessToken(tokenResponse.access_token);
      await loadFiles();
    },
    onError: () => {
      setError('Login failed. Please try again.');
    },
    scope: 'https://www.googleapis.com/auth/drive.file',
  });

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const fileList = await googleDriveService.listFiles();
      setFiles(fileList);
    } catch (err) {
      setError('Failed to load files. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError('File size must be less than 25MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await googleDriveService.uploadFile(file);
      await loadFiles();
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) return;

    try {
      await googleDriveService.deleteFile(fileId);
      await loadFiles();
    } catch (err) {
      setError('Delete failed. Please try again.');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFileIcon = (mimeType, fileName) => {
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('image')) return '🖼️';
    if (mimeType?.includes('word')) return '📝';
    if (mimeType?.includes('sheet')) return '📊';
    return '📎';
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconFileText className="w-10 h-10 text-purple-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect to Google Drive</h2>
          <p className="text-gray-500 mb-6">Access and manage employee documents securely</p>
          <button
            onClick={login}
            className="btn btn-sm btn-ghost px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">📁 Employee Documents Drive</h2>
            <p className="text-purple-100 text-sm">Connected to SpaceBorn Drive</p>
          </div>
          <button
            onClick={() => setUser(null)}
            className="btn btn-sm btn-ghost px-3 py-1 bg-white/20 text-white rounded-lg hover:bg-white/30"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="p-4 border-b">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <label className="cursor-pointer">
            <div className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2">
              <IconUpload className="w-5 h-5" />
              <span>Upload File</span>
            </div>
            <input type="file" onChange={handleFileUpload} className="file-input hidden" disabled={uploading} />
          </label>

          {uploading && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
              <span className="text-sm text-gray-500">Uploading...</span>
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 pr-4 py-2 border rounded-lg w-64"
            />
            <IconSearch className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500">No files found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFiles.map((file) => (
              <div key={file.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow group">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-4xl">{getFileIcon(file.mimeType, file.name)}</div>
                  <button
                    onClick={() => handleDeleteFile(file.id, file.name)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                  >
                    <IconTrash2 className="w-5 h-5" />
                  </button>
                </div>
                <h3 className="font-medium text-gray-900 truncate" title={file.name}>{file.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{formatFileSize(file.size)}</p>
                <div className="mt-3 flex space-x-2">
                  <a href={googleDriveService.getViewUrl(file.id)} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:text-purple-700">
                    View
                  </a>
                  <a href={googleDriveService.getDownloadUrl(file.id)} download className="text-xs text-green-600 hover:text-green-700">
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleDriveViewer;