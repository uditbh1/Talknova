import React, { useState, useRef } from 'react';
import DocViewer, { DocViewerRenderers, DocViewerRef } from '@cyntler/react-doc-viewer';

const DocumentViewer = ({ documents, className, ...props }) => {
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const docViewerRef = useRef<DocViewerRef>(null);

  if (!documents || documents.length === 0) {
    return <div>No documents to display</div>;
  }

  const currentDocument = documents[currentDocIndex];

  const handlePrev = () => {
    if (currentDocIndex > 0) {
      setCurrentDocIndex(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentDocIndex < documents.length - 1) {
      setCurrentDocIndex(prev => prev + 1);
    }
  };

  const renderDocument = () => {
    if (currentDocument.isVideo) {
      // Render video file
      return (
        <video controls width="100%" height="800px" style={{ border: 'none' }} className={className} {...props}>
          <source src={currentDocument.uri} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      );
    } else if (currentDocument.uri.toLowerCase().endsWith('.pdf')) {
      // Render PDF file
      return (
        <iframe
          src={currentDocument.uri}
          title={currentDocument.title || currentDocument.fileName || 'Document'}
          width="100%"
          height="800px"
          style={{ border: 'none' }}
          className={className}
          {...props}
        />
      );
    } else {
      // Render other document formats using DocViewer
      return <DocViewer ref={docViewerRef} documents={documents} pluginRenderers={DocViewerRenderers} className={className} {...props} />;
    }
  };

  return (
    <div className={`${className || ''}`} style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>{currentDocument.title || currentDocument.fileName || 'Untitled Document'}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '16px' }}>
            Document {currentDocIndex + 1} of {documents.length}
          </div>
          <div>
            <button
              onClick={handlePrev}
              disabled={currentDocIndex === 0}
              style={{
                marginRight: '8px',
                padding: '8px 16px',
                cursor: currentDocIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentDocIndex === 0 ? 0.5 : 1,
              }}>
              Prev
            </button>
            <button
              onClick={handleNext}
              disabled={currentDocIndex === documents.length - 1}
              style={{
                padding: '8px 16px',
                cursor: currentDocIndex === documents.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentDocIndex === documents.length - 1 ? 0.5 : 1,
              }}>
              Next
            </button>
          </div>
        </div>
      </div>
      <div>{renderDocument()}</div>
    </div>
  );
};

export default DocumentViewer;
