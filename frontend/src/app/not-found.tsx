import Link from 'next/link'
 
export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>页面未找到</h2>
      <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
        抱歉，您访问的页面不存在。
      </p>
      <Link 
        href="/" 
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: 'var(--accent-primary)',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px'
        }}
      >
        返回首页
      </Link>
    </div>
  )
}
