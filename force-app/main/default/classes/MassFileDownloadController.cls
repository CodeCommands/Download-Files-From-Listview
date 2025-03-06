public with sharing class MassFileDownloadController {
    
    
    @AuraEnabled(cacheable=true)
    public static List<FileWrapper> getFiles(List<Id> recordIds) {
        List<FileWrapper> files = new List<FileWrapper>();
        Map<Id, String> recordNames = getRecordNames(recordIds);

        for (Id recordId : recordIds) {
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.LatestPublishedVersionId, ContentDocument.FileType
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :recordId
            ];

        
            for (ContentDocumentLink link : links) {
                ContentVersion version = [
                    SELECT Title, VersionData, FileExtension
                    FROM ContentVersion
                    WHERE Id = :link.ContentDocument.LatestPublishedVersionId
                ];
                String fileNameWithExtension = version.Title + '.' + version.FileExtension;
                files.add(new FileWrapper(recordNames.get(recordId), fileNameWithExtension, version.VersionData));
            }
        }

        return files;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<FileWrapper> getFilesSL(List<Id> recordIds) {
        List<FileWrapper> files = new List<FileWrapper>();
        Map<Id, String> recordNames = getRecordNames(recordIds);

       
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.LatestPublishedVersionId, ContentDocument.FileType, LinkedEntityId
                FROM ContentDocumentLink
                WHERE LinkedEntityId IN :recordIds
            ];

        	List<Id> latestPublishedVersionIds = new List<Id>();
        	Map<Id, Id> versionIdtoRecordId = new Map<Id, Id>();
            for (ContentDocumentLink link : links) {
                latestPublishedVersionIds.add(link.ContentDocument.LatestPublishedVersionId);
                versionIdtoRecordId.put(link.ContentDocument.LatestPublishedVersionId, link.LinkedEntityId);
            }
            List<ContentVersion> versions = [
                    SELECT Title, VersionData, FileExtension, id
                    FROM ContentVersion
                    WHERE Id IN :latestPublishedVersionIds
                ];
            for(ContentVersion version : versions){
                String fileNameWithExtension = version.Title + '.' + version.FileExtension;
                files.add(new FileWrapper(recordNames.get(versionIdtoRecordId.get(version.id)), fileNameWithExtension, version.VersionData));
            }
        
        return files;
    }


    private static Map<Id, String> getRecordNames(List<Id> recordIds) {
        Map<Id, String> recordNames = new Map<Id, String>();

        if (recordIds.isEmpty()) {
            return recordNames;
        }

        Map<String, Schema.SObjectType> schemaMap = Schema.getGlobalDescribe();
        Set<String> objectTypes = new Set<String>();

        for (Id recordId : recordIds) {
            objectTypes.add(recordId.getSObjectType().getDescribe().getName());
        }

        for (String objectType : objectTypes) {
            Schema.SObjectType sObjectType = schemaMap.get(objectType);
            if (sObjectType != null) {
                String query = 'SELECT Id, Name FROM ' + objectType + ' WHERE Id IN :recordIds';
                List<SObject> records = Database.query(query);
                for (SObject record : records) {
                    recordNames.put(record.Id, (String)record.get('Name'));
                }
            }
        }

        return recordNames;
    }

    public class FileWrapper {
        @AuraEnabled public String recordName { get; set; }
        @AuraEnabled public String fileName { get; set; }
        @AuraEnabled public String body { get; set; }

        public FileWrapper(String recordName, String fileName, Blob body) {
            this.recordName = recordName;
            this.fileName = fileName;
            this.body = EncodingUtil.base64Encode(body);
        }
    }
}