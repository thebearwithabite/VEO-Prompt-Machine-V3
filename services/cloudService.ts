
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * Aether Studio Cloud Service
 * Handles persistence to Google Cloud Storage.
 */

export const DEFAULT_BUCKET = 'veo-studio-126146302540';

/**
 * Uploads forensic audit data to GCS.
 * Note: In a production environment, this would use a backend or pre-signed URLs.
 * For this sandbox, it assumes access to the bucket.
 */
export const uploadToGCS = async (path: string, base64Data: string, mimeType: string, bucketName: string = DEFAULT_BUCKET) => {
  // We use the Gemini API Key as a fallback identifier or assume the environment
  // is configured for direct bucket access in this specific deployment.
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(path)}`;
  
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  // In this version, we attempt the upload. 
  // If the bucket is public-write (for sandbox testing) or ambiently authenticated.
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': mimeType },
    body: blob
  });

  if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `GCS Upload Failed. (Cloud Vault requires configuration)`);
  }
  return `https://storage.googleapis.com/${bucketName}/${path}`;
};
