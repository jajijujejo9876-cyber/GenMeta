
export type ContentType = 'image' | 'video';

export interface MetadataResult {
  file_name: string;
  title: string;
  keywords: string[];
  category: string;
}

export interface GenerationSettings {
  titleLength: number;
  keywordCount: number;
  contentType: ContentType;
}

export interface FileWithStatus {
    file: File;
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: MetadataResult;
    error?: string;
}
