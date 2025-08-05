import { redis } from './redis.js';

export interface FederationJob {
  type: 'deliver_activity' | 'process_follow' | 'sync_remote_actor';
  data: {
    activityId?: string;
    targetInbox?: string;
    actorId?: string;
    remoteActorUri?: string;
    [key: string]: unknown;
  };
}

export class QueueProcessor {
  private isRunning = false;
  private stopRequested = false;

  /**
   * Start processing background jobs
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Queue processor is already running');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    console.log('🚀 Starting queue processor...');

    while (!this.stopRequested) {
      try {
        // Process different queue types
        await Promise.all([
          this.processQueue('federation'),
          this.processQueue('notifications'),
          this.processQueue('cleanup'),
        ]);

        // Wait a bit before checking again
        await this.sleep(1000);
      } catch (error) {
        console.error('Error in queue processor:', error);
        await this.sleep(5000); // Wait longer on error
      }
    }

    this.isRunning = false;
    console.log('⏹️ Queue processor stopped');
  }

  /**
   * Stop the queue processor
   */
  async stop() {
    console.log('🛑 Stopping queue processor...');
    this.stopRequested = true;
    
    // Wait for current processing to finish
    while (this.isRunning) {
      await this.sleep(100);
    }
  }

  /**
   * Process jobs from a specific queue
   */
  private async processQueue(queueName: string) {
    const job = await redis.getFromQueue(queueName, 1); // 1 second timeout
    if (!job) return;

    console.log(`🔄 Processing job from queue ${queueName}:`, job);

    try {
      await this.processJob(queueName, job);
      console.log(`✅ Job completed: ${queueName}`);
    } catch (error) {
      console.error(`❌ Job failed: ${queueName}`, error);
      // Could implement retry logic here
    }
  }

  /**
   * Process individual job
   */
  private async processJob(queueName: string, job: Record<string, unknown>) {
    const jobData = job.data as FederationJob['data'];
    const jobType = (job as any).type || 'unknown';

    switch (queueName) {
      case 'federation':
        await this.processFederationJob(jobType, jobData);
        break;
      case 'notifications':
        await this.processNotificationJob(jobType, jobData);
        break;
      case 'cleanup':
        await this.processCleanupJob(jobType, jobData);
        break;
      default:
        console.log(`Unknown queue type: ${queueName}`);
    }
  }

  /**
   * Process federation-related jobs
   */
  private async processFederationJob(type: string, data: FederationJob['data']) {
    switch (type) {
      case 'deliver_activity':
        if (data.activityId && data.targetInbox) {
          await this.deliverActivity(data.activityId, data.targetInbox);
        }
        break;
      case 'sync_remote_actor':
        if (data.remoteActorUri) {
          await this.syncRemoteActor(data.remoteActorUri);
        }
        break;
      case 'process_follow':
        try {
          console.log(`📩 Processing follow job:`, data);
        } catch (error) {
          console.error('Error processing follow job:', error);
        }
        break;
      default:
        console.log(`Unknown federation job type: ${type}`);
    }
  }

  /**
   * Process notification jobs
   */
  private async processNotificationJob(type: string, data: any) {
    // Placeholder for notification processing
    console.log(`Processing notification job: ${type}`, data);
  }

  /**
   * Process cleanup jobs
   */
  private async processCleanupJob(type: string, data: any) {
    // Placeholder for cleanup tasks (expired cache entries, old activities, etc.)
    console.log(`Processing cleanup job: ${type}`, data);
  }

  /**
   * Deliver an activity to a remote inbox
   */
  private async deliverActivity(activityId: string, targetInbox: string) {
    try {
      // Mark as pending
      await redis.cacheDeliveryStatus(activityId, targetInbox, 'pending');

      console.log(`📤 Delivering activity ${activityId} to ${targetInbox}`);
      const body = JSON.stringify({ id: activityId });
      const response = await fetch(targetInbox, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/activity+json'
        },
        body
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      // Mark as delivered
      await redis.cacheDeliveryStatus(activityId, targetInbox, 'delivered');
      console.log(`✅ Delivered activity ${activityId} to ${targetInbox}`);
    } catch (error) {
      console.error(`Failed to deliver activity ${activityId} to ${targetInbox}:`, error);
      await redis.cacheDeliveryStatus(activityId, targetInbox, 'failed');
    }
  }

  /**
   * Sync remote actor data
   */
  private async syncRemoteActor(remoteActorUri: string) {
    try {
      console.log(`🔄 Syncing remote actor: ${remoteActorUri}`);
      const response = await fetch(remoteActorUri, {
        method: 'GET',
        headers: {
          'Accept': 'application/activity+json, application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json().catch(() => null);
      console.log(`🧾 Fetched remote actor data for ${remoteActorUri}:`, data);
    } catch (error) {
      console.error(`Failed to sync remote actor ${remoteActorUri}:`, error);
    }
  }

  /**
   * Add a job to a queue
   */
  static async addJob(queueName: string, type: string, data: any, delay?: number) {
    const job: FederationJob = { type: type as any, data };
    await redis.addToQueue(queueName, job, delay);
    console.log(`➕ Added job to ${queueName} queue: ${type}`);
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(queueName: string) {
    return await redis.getQueueStats(queueName);
  }

  /**
   * Helper function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const queueProcessor = new QueueProcessor();
