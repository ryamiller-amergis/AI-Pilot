import { retryWithBackoff, sleep } from '../utils/retry';

describe('Retry Utility', () => {
  describe('retryWithBackoff', () => {
    it('should return result on first successful attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 status code', async () => {
      const error = new Error('Rate limited');
      (error as any).statusCode = 429;

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn, 3, 1); // Use 1ms delay for speed

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx status codes', async () => {
      const error500 = new Error('Server error');
      (error500 as any).statusCode = 500;

      const error503 = new Error('Service unavailable');
      (error503 as any).statusCode = 503;

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error500)
        .mockRejectedValueOnce(error503)
        .mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn, 3, 1); // Use 1ms delay for speed

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const error = new Error('Rate limited');
      (error as any).statusCode = 429;

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const startTime = Date.now();
      await retryWithBackoff(mockFn, 3, 10); // Use 10ms as base delay
      const elapsed = Date.now() - startTime;

      // First retry: 10ms, Second retry: 20ms = ~30ms total minimum
      expect(elapsed).toBeGreaterThanOrEqual(25); // Allow some variance
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw non-retryable errors immediately', async () => {
      const error = new Error('Bad request');
      (error as any).statusCode = 400;

      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(mockFn)).rejects.toThrow('Bad request');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exhausted', async () => {
      const error = new Error('Rate limited');
      (error as any).statusCode = 429;

      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(mockFn, 3, 1)).rejects.toThrow('Rate limited');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should handle errors with status property', async () => {
      const error = new Error('Server error');
      (error as any).status = 500;

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn, 3, 1); // Use 1ms delay for speed

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should use default maxRetries and initialDelay', async () => {
      const error = new Error('Rate limited');
      (error as any).statusCode = 429;

      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await retryWithBackoff(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle errors without status code', async () => {
      const error = new Error('Generic error');

      const mockFn = jest.fn().mockRejectedValue(error);

      await expect(retryWithBackoff(mockFn)).rejects.toThrow('Generic error');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified milliseconds', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow small variance
      expect(elapsed).toBeLessThan(100);
    });
  });
});
