'use client';

import { SegmentError } from '@/components/feedback/SegmentError';

export default function DashboardError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <SegmentError {...props} />;
}
