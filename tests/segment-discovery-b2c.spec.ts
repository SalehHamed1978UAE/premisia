import { describe, it, expect, vi } from 'vitest';
import { detectSegmentationMode } from '../server/services/segment-discovery-engine';

describe('Segment Discovery B2C Mode', () => {
  describe('detectSegmentationMode', () => {
    it('should detect B2C mode for b2c_software offering type', () => {
      expect(detectSegmentationMode('b2c_software')).toBe('b2c');
    });

    it('should detect B2C mode for physical_product offering type', () => {
      expect(detectSegmentationMode('physical_product')).toBe('b2c');
    });

    it('should detect B2C mode for content_education offering type', () => {
      expect(detectSegmentationMode('content_education')).toBe('b2c');
    });

    it('should detect B2B mode for b2b_software offering type', () => {
      expect(detectSegmentationMode('b2b_software')).toBe('b2b');
    });

    it('should detect B2B mode for professional_services offering type', () => {
      expect(detectSegmentationMode('professional_services')).toBe('b2b');
    });

    it('should detect B2B mode for marketplace_platform offering type', () => {
      expect(detectSegmentationMode('marketplace_platform')).toBe('b2b');
    });

    it('should detect B2B mode for other offering type', () => {
      expect(detectSegmentationMode('other')).toBe('b2b');
    });

    it('should detect B2B mode for unknown offering type', () => {
      expect(detectSegmentationMode('unknown_type')).toBe('b2b');
    });
  });
});
