// CLIENT CONFIGURATION
// TODO: YOU MUST REPLACE THIS WITH YOUR OWN CLIENT ID FROM GOOGLE CLOUD CONSOLE
// Instructions: https://console.cloud.google.com/apis/credentials
const CLIENT_ID = '147014809034-7gutfn4f1shco9jh32a3akbddenoq2gh.apps.googleusercontent.com'; 
const API_KEY = ''; // Optional for this flow, Client ID is sufficient for implicit flow usually, but some setups might need it.
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'streamflow_backup.json';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const googleDriveService = {
  isConfigured: () => {
      return CLIENT_ID !== '147014809034-7gutfn4f1shco9jh32a3akbddenoq2gh.apps.googleusercontent.com';
  },

  // Initialize the Google API Client
  init: async () => {
    return new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined' || !window.gapi || !window.google) {
          reject("Google Scripts not loaded");
          return;
      }

      const gapiLoaded = () => {
        window.gapi.load('client', async () => {
          await window.gapi.client.init({
            // apiKey: API_KEY, // Uncomment if you generate an API Key
            clientId: CLIENT_ID,
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiInited = true;
          checkInit();
        });
      };

      const gisLoaded = () => {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: '', // defined at request time
        });
        gisInited = true;
        checkInit();
      };

      const checkInit = () => {
        if (gapiInited && gisInited) resolve();
      };

      gapiLoaded();
      gisLoaded();
    });
  },

  // Trigger Login Popup
  signIn: async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        if (!tokenClient) return reject("Google Drive API not initialized");

        tokenClient.callback = async (resp: any) => {
          if (resp.error) {
            reject(resp);
          }
          resolve(resp.access_token);
        };

        if (window.gapi.client.getToken() === null) {
          // Prompt the user to select a Google Account and ask for consent to share their data
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
          // Skip display of account chooser and consent dialog for an existing session
          tokenClient.requestAccessToken({ prompt: '' });
        }
      } catch (e) {
        reject(e);
      }
    });
  },

  // Find existing backup file
  findBackupFile: async () => {
    const response = await window.gapi.client.drive.files.list({
      q: `name = '${BACKUP_FILENAME}' and trashed = false`,
      fields: 'files(id, name, modifiedTime)',
      spaces: 'drive',
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      return files[0];
    }
    return null;
  },

  // Upload Data (Update existing or Create new)
  uploadData: async (jsonData: string) => {
    const file = await googleDriveService.findBackupFile();
    
    const metadata = {
      name: BACKUP_FILENAME,
      mimeType: 'application/json',
    };

    const multipartRequestBody =
      `--foo_bar_baz\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--foo_bar_baz\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${jsonData}\r\n` +
      `--foo_bar_baz--`;

    if (file) {
      // Update existing file
      await window.gapi.client.request({
        path: `/upload/drive/v3/files/${file.id}`,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary=foo_bar_baz' },
        body: multipartRequestBody,
      });
      return { status: 'updated', time: new Date().toISOString() };
    } else {
      // Create new file
      await window.gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary=foo_bar_baz' },
        body: multipartRequestBody,
      });
      return { status: 'created', time: new Date().toISOString() };
    }
  },

  // Download Data
  downloadData: async (): Promise<string | null> => {
    const file = await googleDriveService.findBackupFile();
    if (!file) return null;

    const response = await window.gapi.client.drive.files.get({
      fileId: file.id,
      alt: 'media',
    });

    // Depending on the library version, body might be in result or body
    return typeof response.body === 'string' ? response.body : JSON.stringify(response.result);
  }
};