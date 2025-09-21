
import type { MetadataResult } from './types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const downloadCsv = (results: MetadataResult[]) => {
  if (results.length === 0) return;

  const header = ['File Name', 'Title', 'Keywords', 'Category'];
  const rows = results.map(r => [
    `"${r.file_name.replace(/"/g, '""')}"`,
    `"${r.title.replace(/"/g, '""')}"`,
    `"${r.keywords.join(';')}"`,
    `"${r.category.replace(/"/g, '""')}"`
  ]);

  const csvContent = [header.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.href) {
    URL.revokeObjectURL(link.href);
  }
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', 'adobe_stock_metadata.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
