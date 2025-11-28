import { NextPage } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Finding {
  id: number
  type: string
  severity: string
  file_path: string | null
  line_number: number | null
  message: string
  suggestion: string | null
  created_at: string
}

interface ReviewDetail {
  id: number
  job_id: string
  repo: string
  pr_number: number
  commit_sha: string
  status: string
  quality_score: number | null
  uml_s3_url: string | null
  github_comment_id: string | null
  created_at: string
  completed_at: string | null
  findings: Finding[]
}

const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || 'http://localhost:5000'

const ReviewDetailPage: NextPage = () => {
  const router = useRouter()
  const { id } = router.query
  const [review, setReview] = useState<ReviewDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchReviewDetail(id as string)
    }
  }, [id])

  const fetchReviewDetail = async (reviewId: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${ORCHESTRATOR_URL}/internal/reviews/${reviewId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Review not found')
        }
        throw new Error(`Failed to fetch review: ${response.statusText}`)
      }
      
      const data = await response.json()
      setReview(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load review')
      console.error('Error fetching review:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return '#10b981'
      case 'running':
        return '#3b82f6'
      case 'pending':
        return '#f59e0b'
      case 'failed':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#ef4444'
      case 'high':
        return '#f59e0b'
      case 'medium':
        return '#3b82f6'
      case 'low':
        return '#10b981'
      default:
        return '#6b7280'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'security_issue':
        return '#ef4444'
      case 'code_smell':
        return '#f59e0b'
      case 'suggestion':
        return '#3b82f6'
      case 'best_practice':
        return '#10b981'
      default:
        return '#6b7280'
    }
  }

  // Get top findings (sorted by severity, then by type)
  const topFindings = review?.findings
    .sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const aOrder = severityOrder[a.severity as keyof typeof severityOrder] || 0
      const bOrder = severityOrder[b.severity as keyof typeof severityOrder] || 0
      return bOrder - aOrder
    })
    .slice(0, 10) || []

  return (
    <>
      <Head>
        <title>Review #{id} - AI Code Reviewer Dashboard</title>
        <meta name="description" content="Review details" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={{
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Link href="/" style={{
            display: 'inline-block',
            marginBottom: '1.5rem',
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.875rem'
          }}>
            ← Back to Reviews
          </Link>

          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            marginBottom: '2rem',
            color: '#1a1a1a'
          }}>
            Review #{id}
          </h1>

          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: '#6b7280' }}>Loading review...</p>
            </div>
          )}

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              color: '#991b1b'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {!loading && !error && review && (
            <div style={{
              display: 'grid',
              gap: '1.5rem'
            }}>
              {/* Review Info Card */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                padding: '1.5rem'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  marginBottom: '1rem',
                  color: '#1a1a1a'
                }}>
                  Review Information
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '1rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Repository</div>
                    <div style={{ fontWeight: '600', color: '#1a1a1a' }}>{review.repo}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>PR Number</div>
                    <div style={{ fontWeight: '600', color: '#1a1a1a' }}>#{review.pr_number}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Status</div>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      backgroundColor: `${getStatusColor(review.status)}20`,
                      color: getStatusColor(review.status)
                    }}>
                      {review.status}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Quality Score</div>
                    <div style={{
                      fontWeight: '600',
                      fontSize: '1.25rem',
                      color: review.quality_score !== null
                        ? (review.quality_score >= 80 ? '#10b981' : review.quality_score >= 60 ? '#f59e0b' : '#ef4444')
                        : '#9ca3af'
                    }}>
                      {review.quality_score !== null ? review.quality_score : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Commit SHA</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#1a1a1a' }}>
                      {review.commit_sha.substring(0, 8)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Created At</div>
                    <div style={{ color: '#1a1a1a' }}>{formatDate(review.created_at)}</div>
                  </div>
                  {review.completed_at && (
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Completed At</div>
                      <div style={{ color: '#1a1a1a' }}>{formatDate(review.completed_at)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* UML Diagram Card */}
              {review.uml_s3_url && (
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '0.5rem',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  padding: '1.5rem'
                }}>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    marginBottom: '1rem',
                    color: '#1a1a1a'
                  }}>
                    UML Diagram
                  </h2>
                  <a
                    href={review.uml_s3_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  >
                    View UML Diagram →
                  </a>
                </div>
              )}

              {/* Findings Card */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '0.5rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                padding: '1.5rem'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  marginBottom: '1rem',
                  color: '#1a1a1a'
                }}>
                  Findings {review.findings.length > 0 && `(${review.findings.length})`}
                </h2>
                {topFindings.length === 0 ? (
                  <p style={{ color: '#6b7280' }}>No findings available.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {topFindings.map((finding) => (
                      <div
                        key={finding.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          backgroundColor: '#f9fafb'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: `${getTypeColor(finding.type)}20`,
                            color: getTypeColor(finding.type),
                            textTransform: 'capitalize'
                          }}>
                            {finding.type.replace('_', ' ')}
                          </span>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            backgroundColor: `${getSeverityColor(finding.severity)}20`,
                            color: getSeverityColor(finding.severity),
                            textTransform: 'capitalize'
                          }}>
                            {finding.severity}
                          </span>
                          {finding.file_path && (
                            <span style={{
                              fontSize: '0.875rem',
                              color: '#6b7280',
                              fontFamily: 'monospace'
                            }}>
                              {finding.file_path}{finding.line_number && `:${finding.line_number}`}
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontWeight: '600',
                          marginBottom: '0.5rem',
                          color: '#1a1a1a'
                        }}>
                          {finding.message}
                        </div>
                        {finding.suggestion && (
                          <div style={{
                            padding: '0.75rem',
                            backgroundColor: '#eff6ff',
                            borderLeft: '3px solid #3b82f6',
                            borderRadius: '0.25rem',
                            fontSize: '0.875rem',
                            color: '#1e40af'
                          }}>
                            <strong>Suggestion:</strong> {finding.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}

export default ReviewDetailPage

