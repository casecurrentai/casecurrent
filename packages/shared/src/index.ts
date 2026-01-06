/**
 * CounselTech Shared Types and Utilities
 * 
 * This package contains shared TypeScript types, interfaces,
 * and utility functions used across the CounselTech platform.
 */

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Health Check Response
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version?: string;
}

// Utility function to create API responses
export function createApiResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResponse(error: string): ApiResponse<never> {
  return {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
}

// Version info
export const VERSION = '1.0.0';
export const APP_NAME = 'CounselTech';
