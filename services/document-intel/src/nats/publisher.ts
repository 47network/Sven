// ---------------------------------------------------------------------------
// NATS Event Publisher — Document Intelligence
// ---------------------------------------------------------------------------

import { type NatsConnection, JSONCodec } from 'nats';
import { NATS_SUBJECTS } from '@sven/shared';

const jc = JSONCodec();

export class DocumentPublisher {
  constructor(private readonly nc: NatsConnection) {}

  publishOcrComplete(jobId: string, orgId: string, language: string, regions: number, avgConfidence: number): void {
    this.nc.publish(
      NATS_SUBJECTS.DOCUMENT_OCR_COMPLETE,
      jc.encode({ jobId, orgId, language, regions, avgConfidence, timestamp: new Date().toISOString() }),
    );
  }

  publishPipelineComplete(jobId: string, orgId: string, docType: string, stages: number, processingMs: number): void {
    this.nc.publish(
      NATS_SUBJECTS.DOCUMENT_PIPELINE_COMPLETE,
      jc.encode({ jobId, orgId, docType, stages, processingMs, timestamp: new Date().toISOString() }),
    );
  }

  publishPipelineFailed(jobId: string, orgId: string, docType: string, error: string): void {
    this.nc.publish(
      NATS_SUBJECTS.DOCUMENT_PIPELINE_FAILED,
      jc.encode({ jobId, orgId, docType, error, timestamp: new Date().toISOString() }),
    );
  }

  publishBatchComplete(batchId: string, orgId: string, total: number, succeeded: number, failed: number): void {
    this.nc.publish(
      NATS_SUBJECTS.DOCUMENT_BATCH_COMPLETE,
      jc.encode({ batchId, orgId, total, succeeded, failed, timestamp: new Date().toISOString() }),
    );
  }

  publishEntitiesExtracted(jobId: string, orgId: string, entityCount: number, piiCount: number): void {
    this.nc.publish(
      NATS_SUBJECTS.DOCUMENT_ENTITIES_EXTRACTED,
      jc.encode({ jobId, orgId, entityCount, piiCount, timestamp: new Date().toISOString() }),
    );
  }

  publishSummaryGenerated(jobId: string, orgId: string, documentId: string, style: string, compressionRatio: number): void {
    this.nc.publish(
      NATS_SUBJECTS.DOCUMENT_SUMMARY_GENERATED,
      jc.encode({ jobId, orgId, documentId, style, compressionRatio, timestamp: new Date().toISOString() }),
    );
  }

  publishPiiDetected(jobId: string, orgId: string, piiCategories: string[], count: number): void {
    this.nc.publish(
      NATS_SUBJECTS.DOCUMENT_PII_DETECTED,
      jc.encode({ jobId, orgId, piiCategories, count, timestamp: new Date().toISOString() }),
    );
  }
}
