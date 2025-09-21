
import React, { useState, useCallback, useMemo, ChangeEvent, DragEvent, useRef } from 'react';
import { ContentType, FileWithStatus, GenerationSettings, MetadataResult } from './types';
import {
    DEFAULT_KEYWORD_COUNT,
    DEFAULT_TITLE_LENGTH,
    MAX_KEYWORD_COUNT,
    MAX_TITLE_LENGTH,
    MIN_KEYWORD_COUNT,
    MIN_TITLE_LENGTH
} from './constants';
import { generateMetadataForFile } from './services/geminiService';
import { downloadCsv } from './utils';

// --- Helper & UI Components (defined outside App to prevent re-creation on re-renders) ---

const AnimatedBackground: React.FC = () => (
    <div className="fixed inset-0 -z-10 h-full w-full bg-slate-950">
        <div className="absolute bottom-0 left-[-20%] right-0 top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(255,0,182,.15),rgba(255,255,255,0))]"></div>
        <div className="absolute bottom-0 right-[-20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(255,0,182,.15),rgba(255,255,255,0))]"></div>
    </div>
);

const InfoIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block opacity-70">
        <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);

const UploadIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 h-12 w-12 text-gray-400">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
);

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
}
const SettingSlider: React.FC<SliderProps> = ({ label, value, min, max, onChange, disabled }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center text-sm font-medium">
            <label className="text-white/80">{label}</label>
            <span className="px-3 py-1 text-xs font-semibold bg-white/10 rounded-full text-white">{value}</span>
        </div>
        <input type="range" min={min} max={max} value={value} onChange={onChange} disabled={disabled} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
    </div>
);

interface FileUploaderProps {
    onFilesSelected: (files: FileList) => void;
    contentType: ContentType;
    disabled: boolean;
    fileCount: number;
}
const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, contentType, disabled, fileCount }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const acceptedTypes = contentType === 'image' ? 'image/*' : 'video/*';

    const handleDragEnter = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragging(true);
    };
    const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesSelected(e.dataTransfer.files);
        }
    };
    const handleClick = () => {
        inputRef.current?.click();
    };

    return (
        <div className="mt-4">
            <label
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleClick}
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
                    ${disabled ? 'bg-white/5 border-gray-600 cursor-not-allowed' : 'bg-white/10 border-gray-500 hover:border-fuchsia-400 hover:bg-white/20'}
                    ${isDragging ? 'border-fuchsia-400 bg-white/20' : ''}`}
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    {fileCount > 0 ? (
                        <>
                            <p className="text-2xl font-bold text-white">{fileCount}</p>
                            <p className="text-sm text-gray-400">{fileCount === 1 ? 'file selected' : 'files selected'}</p>
                            <p className="text-xs text-gray-500 mt-2">Click or drag to add more files</p>
                        </>
                    ) : (
                        <>
                            <UploadIcon />
                            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-white">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-gray-500">{contentType === 'image' ? 'Images (JPG, PNG, etc.)' : 'Videos (MP4, MOV, etc.)'}</p>
                        </>
                    )}
                </div>
                <input ref={inputRef} id="dropzone-file" type="file" className="hidden" multiple accept={acceptedTypes} onChange={(e) => e.target.files && onFilesSelected(e.target.files)} disabled={disabled} />
            </label>
        </div>
    );
};

interface MetadataCardProps {
  result: MetadataResult;
}
const MetadataCard: React.FC<MetadataCardProps> = ({ result }) => (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-lg animate-fade-in-slide-up transition-all duration-300 hover:border-white/20 hover:bg-white/10">
        <h3 className="font-bold text-lg text-fuchsia-300 truncate" title={result.file_name}>{result.file_name}</h3>
        <p className="text-sm text-white/80 mt-2 font-semibold">Title:</p>
        <p className="text-sm text-white/70">{result.title}</p>
        <p className="text-sm text-white/80 mt-3 font-semibold">Category:</p>
        <p className="text-sm text-white/70 bg-white/10 inline-block px-2 py-1 rounded-md">{result.category}</p>
        <p className="text-sm text-white/80 mt-3 font-semibold">Keywords:</p>
        <div className="flex flex-wrap gap-1 mt-1">
            {result.keywords.map((kw, i) => (
                <span key={i} className="bg-sky-500/20 text-sky-300 text-xs font-medium px-2.5 py-1 rounded-full">{kw}</span>
            ))}
        </div>
    </div>
);

// --- Main App Component ---

export default function App() {
    const [apiKeys, setApiKeys] = useState<string>('');
    const [contentType, setContentType] = useState<ContentType>('image');
    const [files, setFiles] = useState<FileWithStatus[]>([]);
    const [titleLength, setTitleLength] = useState<number>(DEFAULT_TITLE_LENGTH);
    const [keywordCount, setKeywordCount] = useState<number>(DEFAULT_KEYWORD_COUNT);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    const parsedApiKeys = useMemo(() => apiKeys.split(/[\n,]/).map(k => k.trim()).filter(Boolean), [apiKeys]);
    const completedFiles = useMemo(() => files.filter(f => f.status === 'completed'), [files]);
    const failedFiles = useMemo(() => files.filter(f => f.status === 'failed'), [files]);
    const pendingFiles = useMemo(() => files.filter(f => f.status === 'pending' || f.status === 'failed'), [files]);

    const handleFileSelection = (selectedFiles: FileList) => {
        const newFiles: FileWithStatus[] = Array.from(selectedFiles).map(file => ({
            file,
            id: `${file.name}-${file.lastModified}`,
            status: 'pending',
        }));

        // Avoid duplicates
        const combined = [...files];
        newFiles.forEach(nf => {
            if (!combined.some(ef => ef.id === nf.id)) {
                combined.push(nf);
            }
        });
        setFiles(combined);
    };

    const handleGenerate = useCallback(async () => {
        if (pendingFiles.length === 0) {
            setError("No files to process. Please upload new files or clear results.");
            return;
        }
        if (parsedApiKeys.length === 0) {
            setError("Please provide at least one Google AI Studio API Key.");
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setProgress(0);

        const settings: GenerationSettings = { titleLength, keywordCount, contentType };
        const filesToProcess = pendingFiles;

        const totalToProcess = filesToProcess.length;
        let processedCount = 0;

        const promises = filesToProcess.map(fileWithStatus => {
            setFiles(currentFiles => currentFiles.map(f => f.id === fileWithStatus.id ? { ...f, status: 'processing' } : f));
            
            const primaryKeyIndex = files.findIndex(f => f.id === fileWithStatus.id) % parsedApiKeys.length;
            const primaryKey = parsedApiKeys[primaryKeyIndex];
            const sortedKeys = [primaryKey, ...parsedApiKeys.filter(k => k !== primaryKey)];

            return generateMetadataForFile(fileWithStatus.file, settings, sortedKeys)
                .then(result => {
                    setFiles(currentFiles => currentFiles.map(f => f.id === fileWithStatus.id ? { ...f, status: 'completed', result } : f));
                    return { id: fileWithStatus.id, status: 'fulfilled', value: result };
                })
                .catch(err => {
                    setFiles(currentFiles => currentFiles.map(f => f.id === fileWithStatus.id ? { ...f, status: 'failed', error: err.message } : f));
                    return { id: fileWithStatus.id, status: 'rejected', reason: err.message };
                })
                .finally(() => {
                    processedCount++;
                    setProgress((processedCount / totalToProcess) * 100);
                });
        });
        
        await Promise.all(promises);

        setIsLoading(false);
    }, [pendingFiles, parsedApiKeys, titleLength, keywordCount, contentType, files]);
    
    const isReadyForGeneration = parsedApiKeys.length > 0 && files.length > 0;
    const allDone = files.length > 0 && pendingFiles.length === 0 && failedFiles.length === 0;

    return (
        <>
            <AnimatedBackground />
            <main className="relative min-h-screen text-white p-4 sm:p-6 lg:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    <header className="text-center mb-8">
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400">
                            AI Metadata Generator
                        </h1>
                        <p className="mt-2 text-lg text-slate-400 max-w-2xl mx-auto">
                            For Adobe Stock. Powered by Gemini.
                        </p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Control Panel */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* API Keys */}
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-lg">
                                <h2 className="font-semibold text-lg text-white">1. API Keys</h2>
                                <p className="text-sm text-white/60 mt-1">Enter Google AI Studio keys, separated by comma or new line.</p>
                                <textarea
                                    value={apiKeys}
                                    onChange={(e) => setApiKeys(e.target.value)}
                                    placeholder="Enter API Key 1,&#10;Enter API Key 2,&#10;..."
                                    rows={4}
                                    className="mt-4 w-full bg-black/20 border border-white/20 rounded-lg p-3 text-sm focus:ring-2 focus:ring-fuchsia-500 focus:border-fuchsia-500 transition-all duration-200"
                                    disabled={isLoading}
                                />
                                <p className="text-xs text-right text-white/50 mt-1">{parsedApiKeys.length} key{parsedApiKeys.length !== 1 && 's'} detected</p>
                            </div>

                            {/* Settings */}
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-lg">
                                <h2 className="font-semibold text-lg text-white">2. Upload & Settings</h2>
                                
                                <div className="mt-4 space-y-2">
                                    <p className="text-sm font-medium text-white/80">Content Type</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['image', 'video'] as ContentType[]).map(type => (
                                            <button key={type} onClick={() => !isLoading && setContentType(type)} disabled={isLoading} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${contentType === type ? 'bg-fuchsia-500 text-white shadow-lg' : 'bg-white/10 hover:bg-white/20 text-white/80'}`}>
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                
                                <FileUploader onFilesSelected={handleFileSelection} contentType={contentType} disabled={isLoading} fileCount={files.length} />
                                
                                <div className="mt-6 space-y-6">
                                    <SettingSlider label="Max Title Length" value={titleLength} min={MIN_TITLE_LENGTH} max={MAX_TITLE_LENGTH} onChange={e => setTitleLength(parseInt(e.target.value))} disabled={isLoading} />
                                    <SettingSlider label="Keyword Count" value={keywordCount} min={MIN_KEYWORD_COUNT} max={MAX_KEYWORD_COUNT} onChange={e => setKeywordCount(parseInt(e.target.value))} disabled={isLoading} />
                                </div>
                            </div>
                            
                             {/* Actions */}
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-lg sticky top-8">
                                <h2 className="font-semibold text-lg text-white">3. Generate</h2>
                                {error && <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-300 text-sm rounded-lg p-3">{error}</div>}
                                <button
                                    onClick={handleGenerate}
                                    disabled={!isReadyForGeneration || isLoading}
                                    className="w-full mt-4 text-white font-bold py-3 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-500 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 shadow-lg hover:shadow-fuchsia-500/40"
                                >
                                    {isLoading ? 'Generating...' : (failedFiles.length > 0 ? `Retry ${failedFiles.length} Failed Files` : 'Generate Metadata')}
                                </button>
                                <button
                                    onClick={() => downloadCsv(completedFiles.map(f => f.result!))}
                                    disabled={!allDone || completedFiles.length === 0}
                                    className="w-full mt-3 text-white font-bold py-3 px-4 rounded-lg bg-sky-500/20 border border-sky-500/50 transition-all duration-300 ease-in-out transform hover:bg-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Download as CSV
                                </button>
                                {isLoading && (
                                    <div className="mt-4">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-base font-medium text-white/80">Progress</span>
                                            <span className="text-sm font-medium text-white/80">{completedFiles.length} / {files.length}</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2.5">
                                            <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Results Panel */}
                        <div className="lg:col-span-2">
                             <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-lg min-h-[50vh]">
                                <h2 className="font-semibold text-lg text-white">Results</h2>
                                {files.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-96 text-center">
                                        <p className="text-white/60">Your generated metadata will appear here.</p>
                                        <p className="text-sm text-white/40 mt-1">Start by adding API keys and uploading files.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4 max-h-[80vh] overflow-y-auto pr-2">
                                        {files.map((file) => file.result && <MetadataCard key={file.id} result={file.result} />)}
                                        {failedFiles.length > 0 && (
                                            <div className="xl:col-span-2 text-center p-4 bg-red-900/50 border border-red-500/50 rounded-lg">
                                                <p className="font-semibold text-red-200">{failedFiles.length} file{failedFiles.length > 1 ? 's' : ''} failed to process.</p>
                                                <p className="text-sm text-red-300/80">Check your API keys or network and click "Retry Failed Files".</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <footer className="text-center mt-12 py-4 text-sm text-slate-500">
                        <p>This is a UI demonstration and does not store any data.</p>
                    </footer>
                </div>
            </main>
        </>
    );
}
