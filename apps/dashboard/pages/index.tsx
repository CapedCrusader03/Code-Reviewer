import { NextPage } from 'next'
import Head from 'next/head'

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>AI Code Reviewer Dashboard</title>
        <meta name="description" content="AI Code Reviewer Dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
          color: '#1a1a1a'
        }}>
          AI Code Reviewer Dashboard
        </h1>
        <p style={{
          fontSize: '1.2rem',
          color: '#666',
          textAlign: 'center',
          maxWidth: '600px'
        }}>
          Welcome to the AI Code Reviewer Dashboard. Review management interface coming soon.
        </p>
      </main>
    </>
  )
}

export default Home

