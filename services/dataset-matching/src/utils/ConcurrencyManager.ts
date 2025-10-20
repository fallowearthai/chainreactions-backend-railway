/**
 * Concurrency Manager for controlled parallel processing
 * Optimized for database operations and CPU-intensive tasks
 */

export interface ConcurrencyOptions {
  maxConcurrent?: number;
  delayBetweenBatches?: number;
  timeout?: number;
  retryAttempts?: number;
}

export interface TaskResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
  taskId: string;
}

export class ConcurrencyManager {
  private maxConcurrent: number;
  private delayBetweenBatches: number;
  private timeout: number;
  private retryAttempts: number;

  constructor(options: ConcurrencyOptions = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.delayBetweenBatches = options.delayBetweenBatches || 50;
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.retryAttempts = options.retryAttempts || 2;
  }

  /**
   * Process tasks in parallel with controlled concurrency
   */
  async processParallel<T, R>(
    tasks: Array<{ id: string; data: T }>,
    processor: (task: T) => Promise<R>
  ): Promise<Array<TaskResult<R>>> {
    const results: Array<TaskResult<R>> = [];
    const startTime = Date.now();

    // Create batches
    const batches = this.createBatches(tasks);
    console.log(`Processing ${tasks.length} tasks in ${batches.length} batches (max concurrent: ${this.maxConcurrent})`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} tasks`);

      // Process batch with concurrency control
      const batchPromises = batch.map(async (task) => {
        return this.processTaskWithRetry(task.id, task.data, processor);
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
            duration: 0,
            taskId: 'unknown'
          });
        }
      });

      // Add delay between batches to prevent overwhelming the system
      if (i < batches.length - 1 && this.delayBetweenBatches > 0) {
        await this.sleep(this.delayBetweenBatches);
      }
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    console.log(`Completed ${results.length} tasks in ${totalDuration}ms: ${successCount} success, ${failureCount} failures`);

    return results;
  }

  /**
   * Process tasks with streaming results (for large datasets)
   */
  async *processStreaming<T, R>(
    tasks: Array<{ id: string; data: T }>,
    processor: (task: T) => Promise<R>
  ): AsyncGenerator<TaskResult<R>, void, unknown> {
    const batches = this.createBatches(tasks);

    for (const batch of batches) {
      const batchPromises = batch.map(async (task) => {
        return this.processTaskWithRetry(task.id, task.data, processor);
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          yield result.value;
        } else {
          yield {
            success: false,
            error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
            duration: 0,
            taskId: 'unknown'
          };
        }
      }

      // Small delay between batches
      if (this.delayBetweenBatches > 0) {
        await this.sleep(this.delayBetweenBatches);
      }
    }
  }

  /**
   * Create batches based on max concurrency
   */
  private createBatches<T>(tasks: Array<{ id: string; data: T }>): Array<Array<{ id: string; data: T }>> {
    const batches: Array<Array<{ id: string; data: T }>> = [];

    for (let i = 0; i < tasks.length; i += this.maxConcurrent) {
      batches.push(tasks.slice(i, i + this.maxConcurrent));
    }

    return batches;
  }

  /**
   * Process a single task with retry logic
   */
  private async processTaskWithRetry<T, R>(
    taskId: string,
    taskData: T,
    processor: (task: T) => Promise<R>
  ): Promise<TaskResult<R>> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts + 1; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Task timeout after ${this.timeout}ms`)), this.timeout);
        });

        // Race between processor and timeout
        const result = await Promise.race([
          processor(taskData),
          timeoutPromise
        ]);

        const duration = Date.now() - startTime;

        return {
          success: true,
          data: result,
          duration,
          taskId
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt <= this.retryAttempts) {
          // Exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.warn(`Task ${taskId} failed (attempt ${attempt}), retrying in ${backoffDelay}ms:`, lastError.message);
          await this.sleep(backoffDelay);
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      duration,
      taskId
    };
  }

  /**
   * Utility function for sleep/delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get performance statistics
   */
  getStats(results: Array<TaskResult<any>>): {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    successRate: number;
    totalDuration: number;
  } {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = total - successful;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = total > 0 ? totalDuration / total : 0;
    const successRate = total > 0 ? successful / total : 0;

    return {
      total,
      successful,
      failed,
      avgDuration,
      successRate,
      totalDuration
    };
  }

  /**
   * Adaptive batch sizing based on task performance
   */
  async processAdaptive<T, R>(
    tasks: Array<{ id: string; data: T }>,
    processor: (task: T) => Promise<R>,
    options: {
      minBatchSize?: number;
      maxBatchSize?: number;
      targetDuration?: number;
    } = {}
  ): Promise<Array<TaskResult<R>>> {
    const minBatchSize = options.minBatchSize || 2;
    const maxBatchSize = options.maxBatchSize || 10;
    const targetDuration = options.targetDuration || 1000; // 1 second target per batch

    let currentBatchSize = Math.min(this.maxConcurrent, maxBatchSize);
    let results: Array<TaskResult<R>> = [];
    let remainingTasks = [...tasks];

    while (remainingTasks.length > 0) {
      const batch = remainingTasks.splice(0, currentBatchSize);
      const batchStartTime = Date.now();

      const batchResults = await this.processParallel(batch, processor);
      results.push(...batchResults);

      const batchDuration = Date.now() - batchStartTime;

      // Adaptive sizing
      if (batchDuration > targetDuration * 1.5 && currentBatchSize > minBatchSize) {
        // Batch took too long, reduce size
        currentBatchSize = Math.max(minBatchSize, Math.floor(currentBatchSize * 0.8));
        console.log(`Reducing batch size to ${currentBatchSize} due to long duration (${batchDuration}ms)`);
      } else if (batchDuration < targetDuration * 0.5 && currentBatchSize < maxBatchSize) {
        // Batch was quick, increase size
        currentBatchSize = Math.min(maxBatchSize, Math.floor(currentBatchSize * 1.2));
        console.log(`Increasing batch size to ${currentBatchSize} due to short duration (${batchDuration}ms)`);
      }
    }

    return results;
  }
}