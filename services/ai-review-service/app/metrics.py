"""
Prometheus metrics for AI review service
"""

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import time

# Counter for total reviews processed
reviews_total = Counter(
    'reviews_total',
    'Total number of code reviews processed',
    ['status']  # status: success, error
)

# Histogram for AI service latency (LLM call time)
ai_latency_ms = Histogram(
    'ai_latency_ms',
    'AI service call latency in milliseconds',
    buckets=[100, 500, 1000, 2000, 5000, 10000, 30000]  # buckets in ms
)

def get_metrics():
    """Return Prometheus metrics in text format"""
    return generate_latest()

