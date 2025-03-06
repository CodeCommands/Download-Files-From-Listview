import { LightningElement, api, track } from 'lwc';
import getFiles from '@salesforce/apex/MassFileDownloadController.getFiles';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import JSZip from '@salesforce/resourceUrl/jszip';
import fileSaver from '@salesforce/resourceUrl/fileSaver';
import { loadScript } from 'lightning/platformResourceLoader';

export default class MassFileDownload extends LightningElement {
    @api recordIds; // The 'ids' variable from the Flow
    zipInitialized = false;
    fileSaverInitialized = false;
    jszipLib;
    fileSaverLib;

    @track progressPercentage = 0; // Track the percentage of the total progress
    @track progressBarStyle = 'width: 0%'; // Style for the progress bar
    @track recordsProcessed = 0; // Track how many records have been processed
    @track totalRecords = 0; // Total number of records selected for download

    connectedCallback() {
        Promise.all([
            loadScript(this, JSZip),
            loadScript(this, fileSaver)
        ])
            .then(() => {
                this.jszipLib = window.JSZip;
                this.fileSaverLib = window.saveAs;
                this.zipInitialized = true;
                this.fileSaverInitialized = true;
            })
            .catch(error => {
                this.showError('Error loading libraries', error);
            });
    }

    async handleDownload() {
        try {
            // Initialize the total number of records and reset progress
            this.totalRecords = this.recordIds.length;
            this.recordsProcessed = 0;
            this.progressPercentage = 0;
            this.progressBarStyle = 'width: 0%';

            // Iterate over the selected record IDs and process each record separately
            for (const recordId of this.recordIds) {
                const files = await this.fetchFilesForRecord(recordId);
                
                // Check if the record has no files and proceed to the next record
                if (files && files.length > 0) {
                    const record = {
                        recordId: recordId,
                        recordName: files[0].recordName.replace(/[\/\\?%*:|"<>]/g, '_'),
                        files: files
                    };
                    await this.createAndDownloadZip(record);  // Process each record's files individually
                }

                // Update progress even if no files are found
                this.recordsProcessed++;
                this.updateProgress();
            }
        } catch (error) {
            this.showError('Error fetching files', error);
        }
    }

    // Fetch files for a single record
    fetchFilesForRecord(recordId) {
        return getFiles({ recordIds: [recordId] })
            .then(files => {
                //console.log(`Files fetched for record ${recordId}:`, files);
                return files;
            })
            .catch(error => {
                //console.error(`Error fetching files for record ${recordId}:`, error);
                this.showError('Error fetching files for record', error);
                return [];
            });
    }

    // Create and download the ZIP file for a specific record
    createAndDownloadZip(record) {
        return new Promise((resolve, reject) => {
            // If no files are found, immediately resolve the promise and skip the zip creation
            if (record.files.length === 0) {
                //console.log(`No files found for record ${record.recordName}, skipping ZIP creation.`);
                resolve(); // Continue processing the next record
                return;
            }

            const zip = new this.jszipLib();
            let folder = zip.folder(record.recordName);

            // Add files to the folder in the zip
            record.files.forEach(file => {
                folder.file(file.fileName, file.body, { base64: true });
                //console.log(`Added file to zip: ${file.fileName} in folder: ${record.recordName}`);
            });

            // Generate ZIP file as Blob and save using FileSaver
            zip.generateAsync({ type: 'blob' })
                .then(blob => {
                    //console.log(`ZIP file for record ${record.recordName} generated successfully as Blob`);
                    this.fileSaverLib(blob, `${record.recordName}.zip`); // Save each ZIP file individually
                    resolve(); // Resolve the promise after the file is saved
                })
                .catch(error => {
                    //console.error('Error generating ZIP file:', error);
                    this.showError('Error generating ZIP file', error);
                    reject(error); // Reject the promise if there is an error
                });
        });
    }

    // Update the progress bar based on the number of records processed
    updateProgress() {
        this.progressPercentage = Math.floor((this.recordsProcessed / this.totalRecords) * 100);
        this.progressBarStyle = `width: ${this.progressPercentage}%`;
    }

    showError(title, error) {
        let message = 'Unknown error';
        if (error && typeof error === 'object' && 'message' in error) {
            message = error.message;
        } else if (typeof error === 'string') {
            message = error;
        }
        //console.error(`Error: ${title} - ${message}`);
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: 'error'
            })
        );
    }
}